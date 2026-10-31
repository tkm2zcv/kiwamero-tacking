import { execute, queryAll, queryOne } from "./db.ts";
import { MATCH_ID } from "./henrik-model.ts";
import { auditTimeline, validAuditRows } from "./audit-timeline.ts";
import { normalizeHDMatches } from "./match-normalize.ts";
import { HenrikDevError } from "./henrik-errors.ts";
import type { StoredRow } from "./stored-stats";
import {
  summarizeAuditCoverage, type AuditCoverage, type AuditCoveragePeriod, type AuditHistorySummary,
} from "./audit-coverage.ts";

export type { AuditCoverage, AuditCoveragePeriod } from "./audit-coverage";

interface HistoryRow { rowsJson: string; syncedAt: number }
const PROFILES_LIMIT = 20;

export async function auditCoverage(puuid: string): Promise<AuditCoverage> {
  const history = await queryOne<AuditHistorySummary>(
    "SELECT json_array_length(rowsJson) AS expected, syncedAt FROM AuditHistory WHERE puuid = ?", [puuid],
  );
  const periods = await queryAll<AuditCoveragePeriod>(
    `WITH recorded AS (
       SELECT json_extract(r.value, '$.startedAt') AS at,
         coalesce(nullif(json_extract(r.value, '$.seasonShort'), ''),
           strftime('%Y-%m', json_extract(r.value, '$.startedAt'), 'unixepoch')) AS period,
         m.payload, coalesce(m.terminal, 0) AS terminal,
         max(coalesce(m.retryAt, 0), coalesce(m.leaseUntil, 0)) AS next,
         CASE WHEN m.payload IS NOT NULL AND EXISTS (
           SELECT 1 FROM json_each(m.payload, '$.players') WHERE json_extract(value, '$.puuid') = h.puuid
         ) THEN 1 ELSE 0 END AS cached
       FROM AuditHistory h, json_each(h.rowsJson) r
       LEFT JOIN MatchArchive m ON m.matchId = json_extract(r.value, '$.id')
       WHERE h.puuid = ?
     )
     SELECT period, min(at) AS "from", max(at) AS "to", count(*) AS total, sum(cached) AS cached,
       sum(CASE WHEN cached = 0 AND (terminal = 1 OR payload IS NOT NULL) THEN 1 ELSE 0 END) AS unavailable,
       min(CASE WHEN cached = 0 AND terminal = 0 AND payload IS NULL THEN next END) AS next
     FROM recorded GROUP BY period ORDER BY min(at) DESC`, [puuid],
  );
  // Reads must not mutate lifecycle state; enqueueAudit/runAuditQueue release.
  return summarizeAuditCoverage(periods, history ?? undefined);
}

/** IDs come from verified upstream history, never arbitrary client-provided IDs. */
export async function enqueueAudit(input: {
  puuid: string; name: string; tag: string; region: string; rows: StoredRow[];
}) {
  const old = await queryOne<HistoryRow>("SELECT rowsJson, syncedAt FROM AuditHistory WHERE puuid = ?", [input.puuid]);
  const merged = validAuditRows([...input.rows, ...(old ? JSON.parse(old.rowsJson) as StoredRow[] : [])]);
  // Keep the newest rows inside both bounds instead of permanently wedging the
  // manifest at 413 once cumulative history crosses the cap (rows are sorted
  // ascending, so slicing off the head drops the oldest entries).
  let rows = merged.slice(-5000);
  const encoder = new TextEncoder();
  while (rows.length && encoder.encode(JSON.stringify(rows)).length > 1_800_000) {
    rows = rows.slice(Math.ceil(rows.length / 20));
  }
  const rowsJson = JSON.stringify(rows);
  const admitted = await queryOne<{ puuid: string }>(
    `INSERT INTO AuditHistory(puuid, riotName, riotTag, region, rowsJson, syncedAt)
     SELECT ?, ?, ?, ?, ?, ? WHERE
       (SELECT count(*) FROM AuditHistory WHERE active = 1) < ?
       OR EXISTS (SELECT 1 FROM AuditHistory WHERE puuid = ? AND active = 1)
     ON CONFLICT(puuid) DO UPDATE SET rowsJson = excluded.rowsJson, syncedAt = excluded.syncedAt,
       riotName = excluded.riotName, riotTag = excluded.riotTag, region = excluded.region, active = 1
     WHERE AuditHistory.rowsJson = ?
     RETURNING puuid`,
    [input.puuid, input.name, input.tag, input.region, rowsJson, Date.now(), PROFILES_LIMIT, input.puuid, old?.rowsJson ?? null],
  );
  if (!admitted) throw new HenrikDevError(429, "Historical analysis queue is busy", 60);
  await linkAuditRows(input.puuid, rows);
  await releaseCompletedAudits(input.puuid);
  return auditCoverage(input.puuid);
}

async function linkAuditRows(puuid: string, rows: StoredRow[]) {
  const priority = new Set(auditTimeline(rows).candidates.flatMap((c) => c.matchIds));
  // JSON batches avoid D1 parameter limits and stay well below the statement size limit.
  for (let i = 0; i < rows.length; i += 500) {
    const batch = JSON.stringify(rows.slice(i, i + 500).map((r) => ({
      id: r.id, at: r.startedAt, priority: priority.has(r.id) ? 1 : 0,
      terminal: MATCH_ID.test(r.id) ? 0 : 1,
    })));
    // Revive transient terminal tombstones so a past upstream failure cannot
    // suppress the matchId for every current and future audit. Non-tombstone
    // conflicts (payload archived, fetch in flight, leased) are untouched.
    await execute(`INSERT INTO MatchArchive(matchId, terminal, lastStatus)
      SELECT json_extract(value, '$.id'), json_extract(value, '$.terminal'),
        CASE WHEN json_extract(value, '$.terminal') = 1 THEN 400 ELSE NULL END
      FROM json_each(?) WHERE true
      ON CONFLICT(matchId) DO UPDATE SET terminal = 0, retryAt = 0, attempts = 0, lastStatus = NULL
      WHERE MatchArchive.payload IS NULL AND MatchArchive.terminal = 1
        AND excluded.terminal = 0 AND MatchArchive.leaseUntil <= ?`, [batch, Date.now()]);
    await execute(
      `INSERT INTO AuditMatch(puuid, matchId, startedAt, priority)
       SELECT ?, json_extract(value, '$.id'), json_extract(value, '$.at'), json_extract(value, '$.priority')
       FROM json_each(?) WHERE true ON CONFLICT(puuid, matchId) DO UPDATE SET
       priority = max(AuditMatch.priority, excluded.priority)`, [puuid, batch],
    );
  }
}

export async function releaseCompletedAudits(puuid?: string) {
  await execute(`UPDATE AuditHistory SET active = 0 WHERE active = 1
    ${puuid === undefined ? "" : "AND puuid = ?"}
    AND json_array_length(rowsJson) <= (SELECT count(*) FROM AuditMatch WHERE puuid = AuditHistory.puuid)
    AND NOT EXISTS (SELECT 1 FROM AuditMatch a JOIN MatchArchive m ON m.matchId = a.matchId
      WHERE a.puuid = AuditHistory.puuid AND m.payload IS NULL AND m.terminal = 0)`,
    puuid === undefined ? [] : [puuid]);
}

/** Recover an interrupted POST without requiring the browser to remain open. */
export async function repairAuditManifest() {
  const history = await queryOne<{ puuid: string; rowsJson: string }>(
    `SELECT puuid, rowsJson FROM AuditHistory WHERE active = 1
     AND (SELECT count(*) FROM AuditMatch WHERE puuid = AuditHistory.puuid) < json_array_length(rowsJson)
     ORDER BY syncedAt ASC LIMIT 1`,
  );
  if (!history) return;
  await linkAuditRows(history.puuid, JSON.parse(history.rowsJson) as StoredRow[]);
}

export async function loadAuditHistory(puuid: string) {
  const history = await queryOne<HistoryRow>("SELECT rowsJson, syncedAt FROM AuditHistory WHERE puuid = ?", [puuid]);
  const rows = history ? JSON.parse(history.rowsJson) as StoredRow[] : [];
  const ids = [...new Set(auditTimeline(validAuditRows(rows)).candidates.flatMap((c) => c.matchIds))];
  const raw = ids.length ? await queryAll<{ payload: string }>(
    "SELECT payload FROM MatchArchive WHERE payload IS NOT NULL AND matchId IN (SELECT value FROM json_each(?))",
    [JSON.stringify(ids)],
  ) : [];
  const rosters = normalizeHDMatches(raw.map((r) => {
    try { return JSON.parse(r.payload); } catch { return null; }
  })).matches;
  return { rows, rosters, coverage: await auditCoverage(puuid) };
}
