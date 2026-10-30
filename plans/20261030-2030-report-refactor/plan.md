# Report And Acquisition Refactor

## Scope
- Preserve scores, payloads, public SDK exports, cache/lease/quota behavior and UI.
- No schema changes, dependency additions, live ingestion, notifications or deploy.
- Base commit: `951c4ae`; baseline140 tests pass.

## Steps
1. Capture full-report characterizations before structural edits.
2. Separate provider data contracts from the server SDK; preserve type reexports.
3. Isolate archive validation/projection from persistence and leasing.
4. Separate coverage DTO/calculation from SQL; consolidate completion guards.
5. Move roster sampling/validation into report-scope, leaving lobby analysis
   responsible only for computation.
6. Run regressions, lint/typecheck, Next/OpenNext builds and client-boundary
   checks; update architecture/changelog/handoff.

## Validation
- Fixed EN/JA empty/stable/middle-change reports must retain pre-edit JSON hashes.
- Real-SQL tests cover lease ownership, manifest recovery, scoped completion,
  concurrency and budgets; pure tests cover coverage states and archive projection.
- No threshold, benchmark, endpoint, TTL, rate-limit or database migration changes.
- No commit/push requested for this refactor yet.

## Status
- All implementation/review/verification steps complete.
- Final154 tests (14 added), lint/typecheck, Next/OpenNext builds pass.
- Three pre-edit JSON hashes, six DTOs and three moved/computational functions
  retain their original output/syntax.
- Browser dependency-graph guard and18-file secret/DB bundle scan pass.
- Details: [review](../../docs/reports/20261030-report-refactor.md).
- No commit/push/deploy or live API/notification execution.
