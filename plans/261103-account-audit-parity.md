# Account audit parity plan (261103)

## Goal
Reproduce the legacy `tracker.valosmurf.net` account-audit workflow in `kiwamero-tracking` as an independently implemented, heuristic history-change report.

## Scope
- 0-100 score with S/A/B/C bands.
- Breakdown: server/base migration (40), combat transformation (35), rank trajectory/derank (35), role/activity shift (15).
- Optional listed-country context and observed-server comparison.
- Server composition, migration boundary stats, audit timeline, early/recent comparison, act rank history and evidence signals.
- Use stored match-list data only for the initial score; roster enrichment stays optional.

## Safety limits
- Score is a reference index, not an ownership probability or accusation.
- Missing/incomplete data stays unscored or unweighted; it is not evidence of no change.
- Selected-country/server mismatch is contextual evidence only and does not establish location or ownership.

## Implementation notes
- Reuse `StoredRow`, `SeasonRank`, `AccountReport`, `AuditProgress`, `AuditTimeline`, report UI and existing profile loading.
- `src/lib/audit-score.ts` owns the scoring rules; `src/lib/audit-countries.ts` owns selectable country context.
- `?country=<code>` recalculates server-side using the already-loaded report data.

## Verification
- Unit coverage for server migration, optional country mismatch, rank jumps, performance/role shifts and insufficient data.
- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build:worker`, production build/deploy after review.
