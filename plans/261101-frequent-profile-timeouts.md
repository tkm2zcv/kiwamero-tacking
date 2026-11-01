# Frequent Profile Timeouts

## User Report
- The unavailable-timeout message appears often; user suspects encounter fetches.
- Initially prioritized over PUUID rollout. PUUID + recovery later shipped as
  80c68c0, Worker 16237370-c067-46d5-ad8d-a6589f01b9df; the auth issue recurred.

## Approved Investigation
- Read-only production Worker logs and D1 aggregates; no DB writes, manual cron
  runs, notifications, or additional provider reads under this approval.
- Existing separate PUUID approval: max three identity reads; one used (819ms).

## Evidence (2026-11-01)
- Live D1: four per-key buckets, no cooldown, last minute interactive=5,
  background=0. Archive total=552, archived=536, ready=0, pending unlinked=0,
  pending audit-linked=0, active audits=0. Read-only query wrote zero rows.
- Therefore no evidence that encounter/audit enrichment is exhausting quota at
  this snapshot; do not generalize that to all past failures.
- `/api/auth/get-session` sampled at 519ms, watchlist check at 82ms; audit cron
  returned completed=0, failed=0, deferred=0. Initial version was ec3e8f57.
- The quoted message can mean auth deadline or initial account deadline, not
  only stats timeout. Initial logs did not distinguish these phases.
- Code: encounters queues <=150 missing matches only on encounter tab, background
  queue runs each minute under background quota; diagnosis may fetch extra details.
- SDK inflight entries are bare promises with no wall-clock expiry. If a request
  context dies before its timer/promise settles, later requests can join that
  same stuck promise indefinitely. Investigate this with a controlled offline
  reproduction; do not claim it is the confirmed sole production cause yet.

## Next Steps
- Reproduce abandoned inflight behavior before changing it; consider bounded
  leases and generation-safe cleanup/cache writes, not bigger UI timeouts.
- Separate/log auth vs account vs optional-source failures without credentials.
- Consider labelled stored identity/profile recovery only after evidence, keeping
  incomplete data honest and current authorization intact.
- Verify regression/budget/full build, then get approval for any new rollout
  beyond the previously approved PUUID deployment.

## Reproduction And Changes
- Captured the same live profile path finishing at 8,003ms and 8,000ms with low
  CPU. A follow-up D1 SELECT found last provider reservation at 1793515045398,
  before those failures; enrichment cron continued to complete zero jobs.
- Controlled offline SDK reproduction advances the new caller's wall clock by
  20s while abandoned origin work/timers do not progress: retry still joins the
  old promise and makes zero new fetches. This proves a recovery defect; it does
  not by itself prove which phase caused the captured production timeouts.
- HTTP in-flight work now has a 16s wall-clock lease (15s transport + cache I/O).
  Expired jobs are replaced/pruned; identity checks fence old cache writes and
  cleanup so a late old result cannot poison or delete a newer request.
- Deferred profile refresh flags now have 45s leases, skip superseded callbacks,
  and cannot be cleared by an older callback's finally block.
- Post-response warnings distinguish access deadline from identity failure with
  typed reason only, no identifiers/headers/tokens. Production phase still needs
  confirmation after rollout.
- Existing UI 8s/transport 15s limits, data completeness labels, auth and quota
  admission rules are unchanged. No production writes or provider probes done.
- Final 262 tests, lint/typecheck, Worker build/compat gate and scrub pass.
  Browser partial display 8,219ms; cached stale display 63ms. Home/nav/PUUID and
  real loading/error/access-gate browser checks also pass.
- User approved combined commit/push/deploy of this recovery fix, phase logs and
  PUUID feature. No production migration or manual notification.

## Active Monitoring
- Sanitized production tail process: shell 3e95ce. Stop it when finished.

## Auth Cause And Second Fix
- User retest of 16237370 repeatedly logged `[profile] access deadline exceeded`
  at ~8s, proving the failure is before stats-provider work.
- Actual Better Auth 1.7.14 sources: `createBetterAuth` eagerly starts
  `ctx.checkSchema`; adapter `createSchemaCheck` caches its pending promise;
  `toAuthEndpoints` awaits it before session/cookie processing.
- Offline actual module + real SQLite reproduction stalled only schema SQL:
  two fresh cookie-free session calls timed out, with one cached probe.
- Runtime schema validation is now disabled via the supported option. Real
  migration tests still explicitly validate schema, and real session SQL,
  signature/expiry/owner checks are unchanged. Auth-specific copy added.
- 263 tests, lint/typecheck, build/compat/scrub pass; real workerd/D1 validation
  passes with schema I/O blocked and zero external calls. Browser auth timeout
  is distinguished with zero provider calls; PUUID/search/loading checks pass.
- User approved extra commit/push/deploy for this auth fix. Production retest
  must still confirm the affected profile no longer hits access timeouts.
