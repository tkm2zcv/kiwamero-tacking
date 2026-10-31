import { queryAll } from "./db.ts";
import { getMatch } from "./henrikdev.ts";
import { HenrikDevError } from "./henrik-errors.ts";
import { apiKeys } from "./henrik-client.ts";
import { releaseCompletedAudits, repairAuditManifest } from "./audit-history.ts";

export async function runAuditQueue(options: { maxMatches?: number; maxMs?: number } = {}) {
  if (!apiKeys().length) throw new HenrikDevError(503, "No HenrikDev keys configured");
  const until = Date.now() + Math.min(options.maxMs ?? 40_000, 40_000);
  await repairAuditManifest();
  const cap = Math.max(1, Math.min(options.maxMatches ?? 100, 100));
  const summary = { completed: 0, failed: 0, deferred: 0 };
  // Leases are acquired by getMatch; concurrent cron invocations share that path.
  const candidates = await queryAll<{ matchId: string }>(
    `SELECT m.matchId FROM MatchArchive m LEFT JOIN AuditMatch a ON a.matchId = m.matchId
     WHERE m.payload IS NULL AND m.terminal = 0 AND m.retryAt <= ? AND m.leaseUntil <= ?
     GROUP BY m.matchId
     ORDER BY max(coalesce(a.priority, 0)) DESC,
       min(coalesce(a.startedAt, 9223372036854775807)) ASC, m.rowid ASC LIMIT ?`,
    [Date.now(), Date.now(), cap],
  );
  for (let i = 0; i < candidates.length && Date.now() < until; i += Math.max(1, apiKeys().length)) {
    const batch = candidates.slice(i, i + Math.max(1, apiKeys().length));
    const results = await Promise.allSettled(batch.map((m) => getMatch(m.matchId, { priority: "background" })));
    let limited = false;
    for (const r of results) {
      if (r.status === "fulfilled") summary.completed++;
      else if (r.reason instanceof HenrikDevError && r.reason.status === 429) { summary.deferred++; limited = true; }
      else summary.failed++;
    }
    if (results.length && results.every((r) => r.status === "rejected" &&
      r.reason instanceof HenrikDevError && r.reason.status === 429)) {
      const seconds = Math.min(...results.map((r) => r.status === "rejected" ? r.reason.retryAfter : Infinity));
      // Cron can arrive just before the rolling window expires; do not waste
      // an entire minute or permanently skip the same first few jobs.
      if (seconds <= 5 && Date.now() + seconds * 1000 + 15_000 < until) {
        await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
        i -= Math.max(1, apiKeys().length);
        continue;
      }
    }
    if (limited) break;
  }
  await releaseCompletedAudits();
  return summary;
}
