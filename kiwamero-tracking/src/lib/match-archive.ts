import { execute, queryAll, queryOne } from "./db.ts";
import { HenrikDevError } from "./henrik-errors.ts";
import { MATCH_ID, type HDMatch } from "./henrik-model.ts";
import { archivePayload } from "./match-archive-payload.ts";

export { MATCH_ID } from "./henrik-model.ts";
export { archivePayload } from "./match-archive-payload.ts";

export interface ArchiveRow {
  matchId: string; payload: string | null; attempts: number; terminal: number;
  retryAt: number; leaseUntil: number; lastStatus: number | null;
}
const pending = new Map<string, Promise<HDMatch>>();
export async function rememberMatch(raw: HDMatch) {
  const payload = archivePayload(raw);
  await execute(
    `INSERT INTO MatchArchive(matchId, payload, fetchedAt) VALUES (?, ?, ?)
     ON CONFLICT(matchId) DO UPDATE SET payload = excluded.payload, fetchedAt = excluded.fetchedAt,
       terminal = 0, retryAt = 0, lastStatus = 200
     WHERE MatchArchive.payload IS NULL AND MatchArchive.leaseUntil <= ?`,
    [raw.metadata.matchid, payload, Date.now(), Date.now()],
  );
}

export async function readArchivedMatch(id: string): Promise<HDMatch | null> {
  const row = await queryOne<{ payload: string | null }>("SELECT payload FROM MatchArchive WHERE matchId = ?", [id]);
  return row?.payload ? JSON.parse(row.payload) as HDMatch : null;
}

/** Batched archive reads keep progressive views off the upstream request path. */
export async function readArchivedMatches(ids: readonly string[]): Promise<Map<string, HDMatch>> {
  const archived = new Map<string, HDMatch>();
  const unique = [...new Set(ids)].filter((id) => MATCH_ID.test(id));
  for (let i = 0; i < unique.length; i += 100) {
    const rows = await queryAll<{ matchId: string; payload: string }>(
      `SELECT matchId, payload FROM MatchArchive WHERE payload IS NOT NULL
       AND matchId IN (SELECT value FROM json_each(?))`,
      [JSON.stringify(unique.slice(i, i + 100))],
    );
    for (const row of rows) archived.set(row.matchId, JSON.parse(row.payload) as HDMatch);
  }
  return archived;
}

/** Queue immutable match details for the shared background fetcher. */
export async function queueMatchDetails(ids: readonly string[]): Promise<number> {
  const valid = [...new Set(ids)].filter((id) => MATCH_ID.test(id));
  for (let i = 0; i < valid.length; i += 100) {
    await execute(
      `INSERT OR IGNORE INTO MatchArchive(matchId)
       SELECT value FROM json_each(?)`,
      [JSON.stringify(valid.slice(i, i + 100))],
    );
  }
  return valid.length;
}

export async function claimMatch(id: string, now = Date.now(), fresh = false) {
  await execute("INSERT OR IGNORE INTO MatchArchive(matchId) VALUES (?)", [id]);
  const token = crypto.randomUUID();
  const row = await queryOne<{ attempts: number }>(
    `UPDATE MatchArchive SET leaseToken = ?, leaseUntil = ?, attempts = attempts + 1
     WHERE matchId = ? AND leaseUntil <= ? AND (? OR (payload IS NULL AND terminal = 0 AND retryAt <= ?))
     RETURNING attempts`,
    [token, now + 120_000, id, now, fresh, now],
  );
  return row ? { token, attempts: row.attempts } : null;
}

export async function finishMatch(id: string, token: string, raw: HDMatch) {
  const payload = archivePayload(raw, id);
  return queryOne<{ matchId: string }>(
    `UPDATE MatchArchive SET payload = ?, fetchedAt = ?, leaseToken = NULL, leaseUntil = 0,
       retryAt = 0, terminal = 0, lastStatus = 200
     WHERE matchId = ? AND leaseToken = ? RETURNING matchId`, [payload, Date.now(), id, token],
  );
}

export async function failMatch(id: string, token: string, attempts: number, error: unknown, now = Date.now()) {
  const status = error instanceof HenrikDevError ? error.status : 503;
  const rateLimited = status === 429;
  const terminal = !rateLimited && ([400, 401, 403, 404, 410].includes(status) || attempts >= 5);
  const delay = rateLimited && error instanceof HenrikDevError
    ? error.retryAfter * 1000 : Math.min(3_600_000, 30_000 * 2 ** Math.min(attempts - 1, 7));
  await execute(
    `UPDATE MatchArchive SET leaseToken = NULL, leaseUntil = 0, retryAt = ?,
       terminal = ?, lastStatus = ?, attempts = max(0, attempts - ?)
     WHERE matchId = ? AND leaseToken = ?`,
    [now + delay, terminal, status, rateLimited ? 1 : 0, id, token],
  );
}

export function archivedMatch(id: string, fetcher: () => Promise<HDMatch>, fresh = false): Promise<HDMatch> {
  if (!MATCH_ID.test(id)) return Promise.reject(new HenrikDevError(400, "Invalid match ID"));
  const existing = pending.get(id);
  if (existing) return existing;
  const task = (async () => {
    if (!fresh) {
      const hit = await readArchivedMatch(id);
      if (hit) return hit;
    }
    const claim = await claimMatch(id, Date.now(), fresh);
    if (!claim) {
      const hit = !fresh && await readArchivedMatch(id);
      if (hit) return hit;
      const state = await queryOne<ArchiveRow>("SELECT * FROM MatchArchive WHERE matchId = ?", [id]);
      throw new HenrikDevError(state?.terminal ? state.lastStatus ?? 503 : 429, "Match pending or unavailable",
        Math.max(1, Math.ceil(((state?.retryAt || Date.now() + 1000) - Date.now()) / 1000)));
    }
    try {
      const raw = await fetcher();
      await finishMatch(id, claim.token, raw);
      return raw;
    } catch (error) {
      await failMatch(id, claim.token, claim.attempts, error);
      throw error;
    }
  })().finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
