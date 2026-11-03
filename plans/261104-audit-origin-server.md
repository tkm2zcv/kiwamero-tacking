# Initial-to-Recent Server Evidence

- User authorized score addition, then commit/push, including pending UI fixes.
- Score a stable origin shift at30 reference points,15 if a30+ day recording gap
  exists. Initial20 and each half of latest40 must be80% dominated by different
  normalized servers; windows cannot overlap and latest40 must span7+ days.
- This observes stored-history servers, not account creation/residence/country.
- Upgrade matching local server evidence using max(), never sum(). Only combine
  with a performance boundary when it has the same server direction and current
  server remains dominant afterwards; otherwise choose the stronger independent
  assessment instead of adding unrelated dates.
- Preserve insufficient/unassessable rank/KD safeguards and smurf verdict output.
- Explain baseline evidence and actual scored status in both report locales.
- Add regressions for persistent/gradual moves, short visits, missing data,
  alias normalization, long gaps, unrelated dates and duplicate/input order.
- Verify full suite, lint/types, native gates, build/scrub and UI regression.
- Commit/push only: no production DB changes, deploy, live probes or messages.

## Verification

- 326 tests pass, including nine origin regressions; all existing smurf verdict
  characterization hashes remain unchanged.
- Lint/types, native workerd/D1 profile and PNG/watch checks, Next/OpenNext Worker
  build/compatibility/scrub and compiled-CSS browser regression pass.
- Self-review covered independent evidence selection, double-counting, long gaps,
  unavailable rank/server data and honest JA/EN origin-only presentation.
- No independent review or authenticated live-profile visual check performed.
