# Historical/Current Account Audit Review

## Scope And Evidence

- User compared account `fc82cee9-1b5e-5200-a7fe-3e91e9dfb820`:
  - https://tracker.valosmurf.net/tracker/fc82cee9-1b5e-5200-a7fe-3e91e9dfb820
  - https://tracking.kiwamero.dev/valorant/profile/riot/fc82cee9-1b5e-5200-a7fe-3e91e9dfb820/assessment
- Legacy tracker requires login. Previously saved browser session also redirects
  to login; no authentication bypass attempted. Live legacy score is unverified.
- Inspected its currently public manifest and
  `/_next/static/chunks/tracker-tabs-7wIaPKwC.js`, SHA256
  `37f9b096a1e9c733525a1fa238b3ce1500496e49e1256c0be5c07fb38a39b244`.
- Observed legacy logic directly evaluates historical/current rank drops (up to35)
  and initial/current server migration (up to40), separately from an abrupt KD
  change. It also has ACT/population and role-based heuristics. We do not copy
  its proprietary UI text or unsupported identity/ownership/probability claims.
- Read only this account's production D1 snapshot. No Henrik requests, queue
  mutation, DB writes, notifications or deployment.

## Reproduced Root Causes

- 284 stored self-history rows. Original code produces5/C from the same snapshot.
- Historical ACT evidence: E7A3 Immortal1 peak,126 ACT games. This is neither
  126 Immortal games nor proof of historical KD. Profile peak is Immortal2;
  assessment deliberately uses the separately verified ACT record.
- Recent40:2026-10-23 through2026-10-27, owner mean tier10.225,
  KD0.966431, half-window KDs0.948097/0.985560; all40 servers Tokyo.
- Initial20:17 Hong Kong/3 Singapore. Entire stored history contains a492-day gap.
- Prior implementation ignored ACT performance references, required7 recent days
  for origin evidence and halved the remaining local10 server points. It
  over-focused on finding one abrupt, adjacent-window event.

## Revised Contract

- Keep local-event detection and its gap/role safeguards.
- Historical/current mismatch is an independent assessment, not a fabricated
  change point: require60 valid chronological Competitive rows and40 current rows.
- Prior reference:10 observed owner-rank Immortal+ rows, or a strictly earlier
  modern ACT (E5A1+) Immortal+ peak with20+ games and valid win/game counts.
  Never infer historical KD from rank metadata.
- Each recent20 needs16 Gold3-or-lower owner ranks,12 per-game KDs<=1.2 and60
  total deaths; both aggregate halves<=1.1, total<=1.05 and9+ reference-tier gap.
- Rank20 plus combat35; severe struggle (overall<=0.85, halves<=0.9) uses combat55.
  Observed dominant-role changes subtract10 combat points.
- Origin keeps initial20/recent40 non-overlap and80% dominance in each20.
  Forty observed matches do not need an arbitrary7-day span. Gaps do not erase
  endpoint observations, but timing/inactivity remain explicitly unverified.
- Both endpoint signals use the same current40. Compare their complete total
  against each local-event total, including aligned origin reinforcement.
  Never add endpoint/local totals, duplicate server points or duplicate combat.
  Current-period agreement does not establish coincident change dates.
- Cap100; bands S>=70/A>=45/B>=25/C<25 remain uncalibrated reference rules.
  Rank is the owner's recorded tier, not verified opponent/lobby strength.

## Saved-Data Result

- Original5/C -> revised85/S: rank20, combat35, server30, activity0.
- Independent smurf diagnosis stays unchanged.
- This is a rule change, not a measured probability, validation of ownership
  transfer, or a claim that it equals the inaccessible live legacy score.
- Reproduce without external requests:
  `node tools/replay-account-audit.cjs .tmp/261104-compare-profile.json .tmp/261104-current-report.json`.
  Raw snapshot and downloaded third-party code remain ignored local artifacts,
  not committed fixtures or application dependencies.

## Unresolved

- Authenticated live legacy score and identical retrieval coverage are not
  independently verified. Its server-side genealogy construction is not public.
- Threshold calibration, true opponent strength and inactivity effects remain
  unvalidated. Research/implementation were local; subsequent user-approved
  commit/push/rollout results are tracked in the deployment guide and handoff.

## Verification

- 335 tests, lint, TypeScript and saved-snapshot replay pass. The replay asserts
  the same capture time and unchanged independent smurf verdict.
- Native workerd/D1 profile restore and workerd PNG/watch gates pass; no external
  game calls or messages. Next/OpenNext build, compatibility guard and scrub pass.
- Actual JA/EN evidence components plus compiled production CSS pass the browser
  regression at1440/1024/375px, including ACT-count/timing honesty, no horizontal
  overflow, prior encounter copy and dropdown/scroll behavior. No external calls.
- Probe initially rejected the component CSS import without an esbuild output
  file. Fixed the harness to use already served compiled CSS and assert audit
  selectors exist; no application CSS workaround.
