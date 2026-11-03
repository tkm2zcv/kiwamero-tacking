# Full-history encounters

## Revised User Scope

- New acquisition is limited to the latest50 matches across all modes, regardless
  of the displayed playlist/Act. Existing older archives remain readable.
- Add a visible ALL playlist category on Encounters.
- Reuse shared immutable matches and skip cached/unavailable positions before
  each request. Keep concurrent renders/Cron from making duplicate bulk calls.
- Replace the never-deployed unbounded target set with a bounded recent snapshot.
- Four configured keys continue round-robin under the shared quota/cooldowns.
- Recent50 verification:305/305 tests, lint/typecheck, native workerd PNG/watch,
  Next production build, OpenNext Worker compatibility and bundle scrub pass.
- Self-review checked snapshot leases, shared archive reuse, global recent
  selection and preserved display filters. No independent/browser/live import
  review performed. Production remains unchanged.

## Scope

- Replace encounter per-ID backfill with background v4 pages, size10.
- All means every stored match in the selected playlist, not two recent Acts.
- Read all archived IDs before applying fetch budgets. Share immutable matches.
- Persist per-PUUID target IDs, cursor, leases, retries and stop state in D1.
- Resume after failures without consuming foreground profile deadlines.
- Preserve existing recent-profile/watch endpoints and account/smurf scoring.
- No live bulk import, production migration, push or deploy. Three further
  user-approved size-limit probes are recorded in the research report.

## Work

- [x] Regression tests for >150 archived matches and complete history paging.
- [x] Validate/convert v4 wire data into the existing shared archive format.
- [x] Add idempotent migration, target manifest and lease-protected page worker.
- [x] Integrate minute cron, all-scope archive reads and truthful status UI.
- [x] Keep identity by PUUID; duplicate pages/matches and renames do not inflate.
- [x] Test quotas, retries, partial pages, gaps, new history and concurrent cron.
- [x] Run tests, lint, typecheck, native workerd and Next/Worker build/scrub.
- [x] Update operational docs with costs and required additive migration.

## Verification

- Earlier full-history draft:297 tests and build gates passed; superseded by
  the recent50 scope and305-test gates above.
- Next production build, OpenNext Worker compatibility and bundle scrub pass.
- Self-review checked scope, cache memory, leases, retries and archive reuse.
- Independent review, authenticated browser check and live703-match import
  remain unperformed. Production approval is pending.

## Limits

- API storage is not all Riot history; unavailable rosters remain unavailable.
- A10-match page is one HTTP call, not necessarily one quota credit.
- Offset shifts can produce gaps; coverage comes from actual match IDs, not cursor.
- UI can refresh for a bounded period; Cron continues without the browser.
