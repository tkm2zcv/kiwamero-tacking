# Profile Loading Budget

## Goal
- Target a meaningful profile within 10 seconds, not an endless skeleton.
- Never represent unavailable data as zero statistics or measured empty history.
- External outages / browser connectivity are outside an absolute delivery SLA.

## Findings
- Account lookup precedes four parallel reads, each transport attempt allowed 15s.
- Key rotation could multiply that timeout; recent matches also wait on D1 writes.
- Optional failures discard the entire profile; cache misses repeat on cold isolates.
- Auth/nav reads and streamed report/detail sections also need bounded waits.

## Implementation
- [x] One absolute 8s foreground budget from the profile route, including auth.
- [x] Bound identity, section reads, and nav auth; keep authorization fail-closed
  without prematurely classifying a slow valid session as logged out.
- [x] Return per-source issues and suppress missing-data aggregates/reports.
- [x] Defer match persistence with Next `after`; retain existing queue behavior.
- [x] Cache only complete successful snapshots; label stale data and refresh after response.
- [x] Bound underlying rotations/body reads and best-effort edge-cache operations.
- [x] Run regression, browser-latency, lint, typecheck, and build checks.
- [x] Record measured results and production verification limitations.

## Verification
- Unit: slow identity, parallel reads sharing the budget, honest partial data,
  late completion, cache keys/TTL/cap, cold-isolate reuse, bounded rotations.
- Offline integration: real profile route/data/HTTP/quota code and browser,
  controlled stalled upstream, cache-first revisit, and access gate before cache.
- No live provider calls or production writes are needed for regression checks.
- Final: 244/244 tests, lint/typecheck, Next/OpenNext build and bundle scrub pass.
  Offline browser: stalled optional source 8,118ms; cached snapshot 80ms.
  Auth remains checked before cache; slow valid sessions and private invalidation
  are exercised. Production auth/provider latency is not measured or guaranteed.
- [x] Approved commit/push/deploy: code `e5cd950`, Worker
  `472e648d-41dd-47bb-bf03-2731d1d75ad2`. Live page smoke 200 and anonymous API
  403; auth gate intact. No DB migration or manual notifications. Authenticated
  data latency is a remaining observational check, not a verified live SLA.
