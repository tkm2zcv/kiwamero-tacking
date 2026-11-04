# Direct Profile Relay Navigation

- User supplied the confirmation screen and explicitly requests no extra click.
- Allow authorized, non-speculative top-level external documents regardless of
  Sec-Fetch-User; keep allowlisting, strict API and frame/fetch/speculation guards.
- This deliberately permits normal profile data/cache refresh after an external
  document navigation. It is not a grant to enqueue explicit detail enrichment
  or send notifications, and is not a blanket relaxation of API CSRF checks.
- Remove confirmation branch/link/copy; retain navigation-specific blocked hints.
- Verify real-browser HTML/JS relays land on the profile with unchanged tab/filter
  URL and no second click, unauthorized/embedded requests remain zero-spend.
- Run all gates. Local only; no commit/push/deploy without release approval.

## Results

- Fresh343 tests, lint/types, native D1/PNG, Worker build/scrub, audit layout and
  full profile-budget/browser gates pass.
- Actual Chromium meta-refresh and delayed-JS relays reach the authorized
  assessment page directly; no second click and query/tab preserved.
- Unauthorized/embedded/speculative requests remain zero-spend; APIs stay strict.
- Local only, no commit/push/deploy. User's actual Google flow remains unverified.

## Approved Rollout

- User approved commit/push/deploy after the direct-navigation report.
- Re-run all gates, push the reviewed code, deploy the scrubbed bundle.
- Verify version100%, BUILD_ID, public routes and unauthorized/API gates.
- No DB/auth/allowlist writes, migrations, manual game ingestion or notifications.
- Keep actual authenticated production spreadsheet verification distinct.
