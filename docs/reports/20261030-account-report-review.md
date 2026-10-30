# Account Report Logic Review And Tracker UI

Status: implemented and verified locally, not deployed. 2026-10-30.
Scope: `kiwamero-tracking/`; preserves the concurrent anonymous-search-history work.

## Findings Fixed

1. High: no stored history produced audit 45; missing level produced alt 38.
   Null scores/rank/comparison now represent insufficient evidence. Missing
   level, missing servers and short retrieved spans are not suspicious evidence.
2. High: 30 stored rows bypassed the roster gate. Diagnosis now requires 10
   complete Competitive rosters and at least 5 decided matches.
3. High: lifetime stats, selected historical-act rosters and today's rank were
   mixed. Both reports now have an explicit account-wide Competitive scope;
   diagnosis uses the same recent matches for stats, owner rank and primary role.
   ACT/mode filters are not offered on these two tabs.
4. High: assumed model markers were represented as empirical P95, posterior
   probabilities, MLE and a 90% confidence interval. Those claims are removed.
   The UI exposes assumed means/upper markers and a heuristic model range.
5. High: high stats could accuse cheating or establish ownership changes.
   Cheat score/verdict is replaced by a descriptive outlier index. No ownership,
   sharing, boosting, fair-play or identity claims follow from this report.
6. Medium: current Riot ID matching dropped historical matches after a rename.
   Diagnosis now matches PUUID; renaming alone adds no audit points.
7. Medium: draws counted as losses; model win-rate deviations increased with
   sample size even at identical effect sizes. Draws are separate, WR uses
   decided games only and its model deviation is `(WR - 50) / 25`.
8. Medium: duplicates inflated samples; opponent ranks depended on input order;
   band midpoints biased rank estimates. Deduplication is by match ID, opponent
   ranks use chronological latest PUUID observations, and actual lobby means
   replace band centers in reference-rank calculations.
9. Medium: arbitrary server choices, sparse cluster data and half-period agent
   changes could independently suggest a handover. They no longer do so.
   A server trend change needs 80% dominance in both 20-match edge windows.
10. Medium: missing stat/shot fields became observed zeroes. Stored normalization
    preserves `statsAvailable`/`accuracyAvailable`; unusable rows are excluded.
    Period HS uses only available shot samples and shows their counts.
11. Medium: partial rosters, invalid teams/ranks/round totals and missing shot
    breakdowns could produce invented lobby metrics. These samples are excluded.
    Zero-death games remain valid; finite aggregate outputs are tested.
12. Medium: unknown agents silently used Duelist baselines; Veto was misclassified
    and Hush was absent. Roles now share the `profile-stats.ts` mapping, verified
    against the public VALORANT-API agent metadata (30 playable agents). Unknown
    primary roles explicitly withhold the model instead of guessing.
13. Medium: audit fetched up to 50 unnecessary historical rosters. It now fetches
    none. Diagnosis tops up only a missing minimum, at most 10 recent match IDs.
    Two spare candidates tolerate unsuitable details; complete but unsuitable
    recent matches are not redundantly refetched. Normalization failures are
    contained in `Promise.allSettled`.

## Formulas And Scope

### Audit

- Deduplicate valid stored Competitive rows. Retrieved history is not a complete
  lifetime record and its span is not account age.
- Require 40 rows before a numeric audit index is shown. Incomparable periods
  are explicitly marked as a partial evaluation, not proof of normal history.
- Adjacent-act peak rank differences: 15 each, cap 30, same episode only,
  20+ recorded games in each act, absolute tier gap >=5.
- Split stored rows chronologically into equal early/recent periods. Both need
  20+ matches, >=80% known ranked tiers, mean tier difference <=2, complete shots.
- Performance change: 25 if two of absolute K/D >=0.4, ACS >=60, HS >=8pt move;
  40 if all three move.
- Server-pattern and agent-pool changes add 15 each only with scored performance
  changes. Total index is bounded to 0-100. Renames and short spans add nothing.

### Diagnosis

- Latest 25 deduplicated Competitive rosters within 90 days; exclude future data.
  Require 10 unique players, two teams of five, valid owner/team/round/shot stats,
  owner rank and at least six other ranked players. Dates describe analyzed
  matches, not rejected rosters.
- Top-up (`report-scope.ts`): only when fewer than 10 valid recent rosters exist;
  request the missing count plus two spare candidates, capped at 10 match IDs.
  Existing detail cache remains 24h. Underlying API-key rotation/retries can
  increase HTTP attempts; revisits do not promise progressive lifetime backfill.
- Per-metric model deviation: `(observed - mean) / max((upper - mean)/1.645, floor)`.
  These are assumed model scales, not measured standard deviations.
- Combat deviation is the mean of K/D, ACS and HS deviations. Composite deviation
  also includes `(WR - 50)/25`.
- Reference tier: each lobby band's actual mean + clipped composite deviation
  `[-1.5, 1.5] / 0.3`, then sample-count-weighted. Clamp to tiers 3-27.
  Model spread: `2 + 3/sqrt(n)` tiers. Bound its range after clamping the center.
  There are no probability distributions or calibrated confidence intervals.
- Rank-mismatch index requires tier gap >=3 and combat deviation >=0.5:
  `12*(gap-2) + 25*max(0, composite) + 15 if WR >=60%`.
- Alt indicators additionally require a known level in 1-79 and combat
  deviation >=0.75: `0.6*rankMismatch + 20`.
- Outlier index requires >=2 metrics with deviation >=2:
  `sum(max(0, deviation-1.5)*20)`. Each index is clamped to 0-100.

## UI

- Reuses the existing extracted tracker.gg tokens, Saira/Roboto font variables,
  `v3-card` header/body, 16px surfaces, 300px summary rail and 24px spacing.
  Not an official tracker.gg library or an assertion of affiliation.
- Descriptive ring summary, score tiles, striped numeric tables, model-rank
  card, server/opponent bars, evidence notes and native methodology disclosure.
- Scoped report CSS; no unrelated navigation/search styles are replaced.
- On mobile, analysis follows the summary; account/sample facts follow later.
  Wide tables scroll within focusable, labelled regions rather than the page.
- English/Japanese copy; unavailable values use `-`, never a fabricated zero.

## Verification

- `npm run check`: lint, typecheck, 116 tests (0 failures), production Next build.
- `npm run build:worker`: completed using project-local TMP/TEMP/TMPDIR.
- 28 report tests cover empty/sparse data, missing stats/shots, mode/date/ID caps,
  renames/PUUID, draws, deathless games, episode resets, coupled changes, unknown
  agents, bounded top-up, latest opponent ranks and uncalibrated-range semantics.
- Live local pages: Meiy#B3L audit 0 from 2,134 valid stored matches; diagnosis
  12/13 valid rosters, reference Radiant, no strong mismatch detected.
- Live local pages: ashrielle#4sh audit 15 from 468 stored matches; diagnosis
  10/10 valid rosters, reference Gold 2 versus sample Silver 2, mismatch index 0
  because the combat-deviation gate was not met. Reference rank is not a verdict.
- Meiy: EN/JA, 1920x1080, 390x844, 360x800; ashrielle: JA, 1440x900, 390x844.
  No document horizontal overflow, no captured JS page errors in the Meiy run.
  Methodology opens/closes with click and Enter.
- Deliberately conflicting ACT/Deathmatch query parameters still show the
  declared Competitive report scope.
- Screenshots and verification scripts live under ignored `.build-tmp/`.
  No secrets committed, notifications sent, production DB changed or deployment.

## Remaining Limits

The benchmark matrix and coefficients are heuristic, not calibrated against a
representative population with verified labels. No measured false-positive rate,
smurf/alt probability, real skill confidence interval or cheat detection accuracy
can be claimed. Population data and out-of-sample validation are a separate task.
