# Persistent Profiles and Incremental Self History

- Keep the existing profile codec, scoped cache keys and stale-first rendering.
- Add D1/SQLite durable compressed snapshots behind memory/edge caching.
- Preserve real capture time, history, identity/mode isolation and size guards.
- Revalidate live rank/account/MMR normally; never treat saved data as fresh.
- Refresh self history with a latest50 stored-list check, merging by match ID.
  Bootstrap or loss of overlap uses one full stored-list response to repair gaps.
- Use D1 leases for stale-profile refreshes across isolates and tombstones to
  prevent revoked/deleted snapshots from being republished by late writers.
- Keep last valid durable data on temporary failures/oversized refreshes.
- Test cold-cache recovery, >24h retention, deltas, gap repair, races and privacy.
- No live API calls, production DB changes, commits, push or deploy.
- Run all tests/lint/typecheck/native workerd/Next+Worker build and scrub.

## Verified Locally

- 313/313 tests pass, including durable BLOB recovery,5000 retained history rows,
  latest-history merge, gap repair, invalidation fences and concurrent leases.
- Lint/typecheck, native workerd/D1 profile codec, PNG/watch regression,
  Next/OpenNext Worker compatibility and bundle scrub pass.
- Self-review checked stale timestamps, player/mode isolation, partial/error
  behavior and DB size guards. No independent review/authenticated browser check.
- No real API calls, production DB changes, commits, push or deploy.
