# 20261103 smurf diagnosis parity review

## Source inspection

- The public tracker chunk exposed the legacy diagnosis UI structure: an overall
  verdict, three score cards, a three-part rank comparison, lobby-band table,
  opponent distribution, direct metric comparison and signal list.
- Server-side scoring remains independently implemented in `kiwamero-tracking`.
  The reference site's population-size, probability, MLE, 90% confidence and
  cheat-detection claims were not reproduced.

## Implemented contract

- Initial diagnosis still uses the existing bounded recent-roster path:
  Competitive only, latest 25 matches within 90 days, PUUID matching, complete
  10-player rosters, at least 10 valid rosters and 5 decided games.
- Overall score displays the maximum of rank-mismatch, alt-account and outlier
  indices. Null scores remain unavailable, never zero-filled.
- Three score cards show smurf, alt-account and statistical-outlier reference
  indices with meters and assumptions.
- Three-way comparison shows displayed rank, average lobby difficulty anchor and
  model reference rank, plus a sample-size-only model confidence label.
- Lobby-band table includes model means, observed stats, model deviations and
  relative labels.
- Opponent distribution shows minimum, average, median and maximum opponent
  ranks plus per-tier counts/percentages.
- Direct model comparison shows observed values, assumed means, assumed upper
  markers, deviations and relative labels.

## Safety wording

- `仮定平均` / `仮定上限` replace empirical mean/P95 wording.
- `統計的異常度` replaces a cheat score; no cheating verdict is exposed.
- `モデル信頼度` is derived only from sample counts, not measured accuracy.
- `モデル幅` replaces 90% confidence interval wording.
- The report cannot establish smurfing, account sharing, boosting, ownership or
  identity.

## Files

- `src/components/profile/diagnosis-panel.tsx`
- `src/components/profile/diagnosis-score.tsx`
- `src/components/profile/diagnosis-pillars.tsx`
- `src/components/profile/diagnosis-lobby.tsx`
- `src/components/profile/report-ui.tsx`
- `src/components/profile/report.css`
- `src/app/valorant/profile/riot/[id]/[[...tab]]/page.tsx`

## Verification

- Full suite: 270/270 pass.
- `lint` and `typecheck`: pass.
- Native workerd watch check: pass with `TMP`/`TEMP` pointed at `.tmp`.
- Next production build: pass.
- OpenNext Worker bundle and deploy-bundle scrub: pass.
- `next.config.ts` now caps static generation at `experimental.cpus: 4`; the
  default 15 workers exhausted Windows virtual memory during local builds.

## Deployment

- Code commit: `aae05f1 feat: restructure smurf diagnosis report`
- Production Worker version: `d9a259a1-828f-4dc2-9e0f-00b52ecd4e58`
- Deploy output: 17ms startup, 12,368.61KiB upload / 3,311.81KiB gzip.
- `https://tracking.kiwamero.dev` and `/login`: HTTP 200 after deployment.

## Unresolved questions

- Whether to add fixture-driven visual snapshots for the report; current tests
  cover the report contract, while this change is primarily presentational.
