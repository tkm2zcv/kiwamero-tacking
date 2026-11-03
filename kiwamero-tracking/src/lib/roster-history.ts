import { execute, queryAll, queryOne } from "./db.ts";
import { MATCH_ID } from "./henrik-model.ts";
import { HenrikDevError } from "./henrik-errors.ts";
import { queueMatchDetails, readArchivedCoverage } from "./match-archive.ts";
import { ENCOUNTER_RECENT_LIMIT } from "./profile-filters.ts";

export interface RosterJob {
  puuid: string; region: string; cursor: number; active: number; exhausted: number;
  blocked: number; lastPage: string | null; updatedAt: number;
  leaseToken: string | null; leaseUntil: number; retryAt: number; attempts: number;
  lastStatus: number | null;
  targetsJson: string; observedAt: number;
}

const pending = `SELECT 1 FROM json_each(RosterHistory.targetsJson) r
  LEFT JOIN MatchArchive m ON m.matchId = r.value
  WHERE m.payload IS NULL AND coalesce(m.terminal, 0) = 0`;

export async function rosterHistoryProgress(puuid: string) {
  const job = await queryOne<RosterJob>("SELECT * FROM RosterHistory WHERE puuid = ?", [puuid]);
  const counts = await queryOne<{ expected: number; cached: number; unavailable: number }>(
    `SELECT count(*) AS expected, coalesce(sum(m.payload IS NOT NULL), 0) AS cached,
      coalesce(sum(m.payload IS NULL AND m.terminal = 1), 0) AS unavailable
     FROM RosterHistory h, json_each(h.targetsJson) r
     LEFT JOIN MatchArchive m ON m.matchId = r.value WHERE h.puuid = ?`, [puuid]);
  const { expected = 0, cached = 0, unavailable = 0 } = counts ?? {};
  return { active: !!job?.active, blocked: !!job?.blocked, cursor: job?.cursor ?? 0,
    exhausted: !!job?.exhausted, expected, cached, unavailable, pending: expected - cached - unavailable };
}

/** Admission only; rendering never calls the provider or creates per-ID fetches. */
export async function enqueueRosterHistory(
  puuid: string, region: string, ids: readonly string[], observedAt = Date.now(),
) {
  if (!MATCH_ID.test(puuid) || !/^[a-z]{2,8}$/i.test(region)) throw new HenrikDevError(400, "Invalid player");
  const unique = [...new Set(ids.filter((id) => MATCH_ID.test(id)))].slice(0, ENCOUNTER_RECENT_LIMIT);
  if (!unique.length) return rosterHistoryProgress(puuid);
  await execute(`INSERT INTO RosterHistory(puuid, region, updatedAt) VALUES (?, ?, ?)
    ON CONFLICT(puuid) DO UPDATE SET region = excluded.region`, [puuid, region, Date.now()]);
  const targets = JSON.stringify(unique), now = Date.now();
  const admitted = await queryOne(`UPDATE RosterHistory SET
      cursor = CASE WHEN targetsJson <> ? THEN 0 ELSE cursor END,
      exhausted = CASE WHEN targetsJson <> ? THEN 0 ELSE exhausted END,
      lastPage = CASE WHEN targetsJson <> ? THEN NULL ELSE lastPage END,
      targetsJson = ?, observedAt = ?
    WHERE puuid = ? AND observedAt <= ? AND leaseUntil <= ? RETURNING puuid`,
    [targets, targets, targets, targets, observedAt, puuid, observedAt, now]);
  if (!admitted) return rosterHistoryProgress(puuid);
  // Retain old associations for archive GC, but only the current50 are pending.
  await execute(`INSERT OR IGNORE INTO RosterHistoryMatch(puuid, matchId)
    SELECT ?, value FROM json_each(?)`, [puuid, targets]);
  await execute(`UPDATE RosterHistory SET active = 1,
      updatedAt = CASE WHEN active = 0 THEN ? ELSE updatedAt END
    WHERE puuid = ? AND blocked = 0 AND EXISTS (${pending})
      AND (active = 1 OR (SELECT count(*) FROM RosterHistory WHERE active = 1) < 20)`, [now, puuid]);
  return rosterHistoryProgress(puuid);
}

export async function claimRosterHistory(now = Date.now()) {
  const token = crypto.randomUUID();
  return queryOne<RosterJob>(`UPDATE RosterHistory SET leaseToken = ?, leaseUntil = ?, attempts = attempts + 1
    WHERE puuid = (SELECT puuid FROM RosterHistory
      WHERE active = 1 AND blocked = 0 AND exhausted = 0 AND retryAt <= ? AND leaseUntil <= ?
      ORDER BY updatedAt ASC, puuid ASC LIMIT 1)
      AND leaseUntil <= ?
      AND NOT EXISTS (SELECT 1 FROM RosterHistory WHERE leaseUntil > ?)
      RETURNING *`, [token, now + 120_000, now, now, now, now]);
}

/** Recheck shared archives immediately before fetching, including other players' work. */
export async function nextRosterRequest(job: RosterJob) {
  const ids = (JSON.parse(job.targetsJson) as string[]).slice(0, ENCOUNTER_RECENT_LIMIT);
  const { archived, unavailable } = await readArchivedCoverage(ids);
  const missing = (id: string) => !archived.has(id) && !unavailable.has(id);
  const start = ids.findIndex((id, i) => i >= job.cursor && missing(id));
  if (start < 0) return null;
  let size = 1;
  while (size < 10 && start + size < ids.length && missing(ids[start + size])) size++;
  return { start, size };
}

export async function finishRosterPage(job: RosterJob, received: number, fingerprint: string, start = job.cursor) {
  const end = Math.min(ENCOUNTER_RECENT_LIMIT, start + received);
  const limit = Math.min(ENCOUNTER_RECENT_LIMIT, (JSON.parse(job.targetsJson) as string[]).length);
  await execute(`UPDATE RosterHistory SET cursor = ?, lastPage = ?,
      exhausted = ?, leaseToken = NULL, leaseUntil = 0, retryAt = 0, attempts = 0,
      lastStatus = 200, updatedAt = ?
    WHERE puuid = ? AND leaseToken = ?`,
    [end, fingerprint, received === 0 || end >= limit || fingerprint === job.lastPage ? 1 : 0,
      Date.now(), job.puuid, job.leaseToken]);
}

export async function failRosterPage(job: RosterJob, error: unknown, now = Date.now()) {
  const status = error instanceof HenrikDevError ? error.status : 503;
  const limited = status === 429, end = status === 404;
  const blocked = !limited && !end && ([400, 401, 403].includes(status) || job.attempts >= 5);
  const seconds = limited && error instanceof HenrikDevError
    ? error.retryAfter : Math.min(3600, 30 * 2 ** Math.min(job.attempts - 1, 7));
  await execute(`UPDATE RosterHistory SET leaseToken = NULL, leaseUntil = 0,
      exhausted = ?, blocked = ?, active = ?, retryAt = ?, lastStatus = ?,
      attempts = max(0, attempts - ?), updatedAt = ?
    WHERE puuid = ? AND leaseToken = ?`,
    [end ? 1 : job.exhausted, blocked ? 1 : 0, blocked ? 0 : 1,
      now + seconds * 1000, status, limited ? 1 : 0, now, job.puuid, job.leaseToken]);
}

/** Only gaps remaining after the bulk scan enter the existing per-ID queue. */
export async function queueRosterGaps() {
  const jobs = await queryAll<{ puuid: string }>(
    "SELECT puuid FROM RosterHistory WHERE active = 1 AND exhausted = 1");
  for (const job of jobs) {
    const ids = await queryAll<{ matchId: string }>(`SELECT r.value AS matchId FROM RosterHistory h,
      json_each(h.targetsJson) r LEFT JOIN MatchArchive m ON m.matchId = r.value
      WHERE h.puuid = ? AND m.payload IS NULL AND coalesce(m.terminal, 0) = 0`, [job.puuid]);
    if (ids.length) await queueMatchDetails(ids.map((r) => r.matchId));
  }
}

export async function releaseCompletedRosterHistories() {
  await execute(`UPDATE RosterHistory SET active = 0
    WHERE active = 1 AND leaseUntil <= ? AND NOT EXISTS (${pending})`, [Date.now()]);
}
