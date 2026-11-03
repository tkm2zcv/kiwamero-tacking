# 20261103 account audit parity review

## Source inspection

- Scrapling 0.5 fetched `tracker.valosmurf.net` but the protected tracker URL
  redirected to Discord login. No login, cookie or bypass was used.
- The public Next chunk exposed the legacy audit tab structure and scoring
  constants. The implementation was rewritten independently; proprietary UI
  text and accusatory wording were not copied.

## Implemented contract

- Stored Competitive rows only; initial scoring remains one history-list read or
  a cache hit. Roster detail enrichment stays optional.
- Minimum: 40 valid stored rows. Insufficient history returns `score: null`.
- Score: `min(100, rank + server + combat + role)`.
- Bands: S>=70, A>=45, B>=25, C<25.
- Breakdown caps:
  - Server/base migration 40: overseas→Tokyo 25, Tokyo→overseas 20,
    overseas→overseas 15, optional listed-country/server mismatch +15.
  - Combat transformation 35: K/D/ACS/HS% period deltas plus rank-band deviations,
    only when existing comparison gates are met.
  - Rank trajectory/derank 35: extreme derank, rapid climb and abrupt drops on
    era-adjusted act records.
  - Role/activity shift 15: support/other role to duelist-heavy recent play.
- Optional `?country=<code>` uses a fixed APAC-oriented country/server mapping
  (`audit-countries.ts`). It is contextual evidence only.

## Safety wording

- The score is labelled a history-change index/reference assessment.
- Country/server mismatch does not establish residence, nationality, identity,
  ownership transfer, cheating or fraud.
- Missing/incomplete history is not treated as evidence of no change.
- Rank benchmarks remain model constants from the observed chunk, not validated
  population probabilities.

## Files

- `src/lib/audit-score.ts`
- `src/lib/audit-countries.ts`
- `src/lib/report-model.ts`
- `src/lib/report-evidence.ts`
- `src/components/profile/account-audit.tsx`
- `src/components/profile/audit-country-select.tsx`
- `src/components/profile/report-ui.tsx`
- `src/components/profile/report.css`
- `src/app/valorant/profile/riot/[id]/[[...tab]]/page.tsx`
- `tests/account-report.test.ts`
- `tests/report-characterization.test.ts`

## Verification

- Targeted report/characterization tests: 32/32 pass.
- Full suite: 270/270 pass.
- `lint`, `typecheck`, native workerd watch check, Next production build,
  OpenNext Worker bundle and deploy-bundle scrub all pass.
- Deployed as `fadcc3ae-717b-41ff-82b4-ff21b3bf2076` from `b9dcf62`.

## Unresolved questions

- Whether to expose an English label exactly matching the legacy UI title; the
  current copy intentionally avoids ownership/accusation wording.
