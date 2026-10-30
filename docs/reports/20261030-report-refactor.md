# Report And Acquisition Refactor

Base: `951c4ae` (already committed/pushed). This refactor is local, not committed
or deployed. No new dependencies, schema/config changes, live API ingestion or
notification execution.

## Responsibilities

- `henrik-model.ts`: six provider DTOs and the shared identifier expression,
  without request, credential or database dependencies.
- `henrikdev.ts`: endpoint wrappers, cache policies and archive integration only.
  Existing provider type exports remain available for compatibility.
- `match-archive-payload.ts`: pure payload validation/projection. `match-archive.ts`
  retains persistence, leases, retries and request coalescing. Legacy payload/ID
  exports still resolve to the same implementations.
- `audit-coverage.ts`: browser-safe progress types and pure coverage aggregation.
  `audit-history.ts` handles SQL/admission/recovery, not presentation calculations.
  Completion checks share one guarded update, optionally scoped to one player.
- `report-scope.ts`: roster validation, sample selection and bounded top-up
  selection. `lobby-analysis.ts` computes the model, without owning validation.
  Its previous `sampleMatches` export remains an alias.
- Progress UI/report types and normalizers import pure contracts directly rather
  than depending on the storage/SDK modules for types.

## Preserved Behavior

- No score, threshold, benchmark, locale text, API route, cache TTL, rate limit,
  public payload, lease duration or retry-policy changes.
- Recorded full JSON report hashes before edits for empty EN, stable JA and
  middle-period-change EN fixtures. All three remain identical after refactoring.
- TypeScript syntax comparison confirmed all six wire interfaces and the
  `archivePayload`, `sampleMatches`, `analyzeLobby` implementations are unchanged
  apart from comments and module placement.
- Consolidated completion SQL retains the manifest-materialization and pending
  job guards; status requests cannot release another player's active record.

## Verification

- Baseline140 tests; final154 tests, zero failures.
- `npm run check`: lint, typecheck, all tests and production Next build pass.
- `npm run build:worker`: OpenNext Worker bundle passes.
- New real-SQL tests cover scoped/global completion and interrupted manifests.
  Pure tests cover coverage states, expected-but-unmaterialized counts, earliest
  retry, immutable inputs, archive projection/refusals and legacy export identity.
- A TypeScript dependency-graph test rejects server-runtime imports/environment
  reads from the extracted pure modules and progress UI.
- Final18-file browser-JS scan: zero configured credential literals and zero
  native SQLite/D1 dependency markers.
- Logs: app `.build-tmp/refactor-baseline-tests.log`, `refactor-final-check.log`,
  `refactor-final-worker.log`, `refactor-final-bundle.log` (ignored artifacts).

## Limits / Remaining Work

- Self-review only; no independent-agent review. No additional browser visual
  session was run: UI markup/styles did not change.
- Scope is report/acquisition boundaries, not a rewrite of the application.
  Existing larger stored-statistics/report-model modules remain unchanged except
  their type-import paths.
- Provider quota independence, production rollout/retention/cost checks and model
  calibration remain the existing operational gates, not solved by refactoring.
