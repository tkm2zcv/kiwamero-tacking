# Profile External Navigation

- User reports an unregistered-account screen after clicking a spreadsheet link.
- Root cause: ProfilePage authenticates successfully, then rejects all
  Sec-Fetch-Site:cross-site requests using the paid-API CSRF predicate, returning
  AccessGate(status:denied). The displayed reason incorrectly implies bad identity.
- Preserve Discord allowlisting and the strict predicate on API endpoints.
- Profile documents only: allow user-activated, top-level navigation
  (cross-site/navigate/document/?1). Reject iframe/fetch/prefetch/prerender and
  non-activated cross-site navigation.
- Reproduce against the real page harness before changing production logic.
- Add metadata-unit, API-route and real-browser redirect/link regressions.
- Verify full tests, profile budget, native Worker checks, build and layout.
- Local fix only; no allowlist edits, auth DB writes, live game calls or deployment.

## Results

- Real-page regression reproduced the denied-account screen with allowed access
  and user-activated cross-site headers before the fix.
- Profile-only exception passes metadata/API regressions and a real browser
  click plus302 redirect. Authentication, iframe/fetch/speculation guards remain.
- Full339 tests, lint/types, native D1/PNG, build/scrub and browser/layout pass.
- Existing profile-budget harness refreshed for current router hooks and durable
  snapshots: age seeded only in the isolated memory DB, unknown identity uses a
  genuinely unseen ID. No weakening of product persistence or auth.
- User approved commit/push only; production not changed. Actual user's browser
  session is not inspected; normal-navigation policy is reproduced offline.

## Subsequent Approved Deployment

- User approved production rollout after source commits7a613e0/97465b6.
- Worker `fbf6077b-db34-42fb-a5a3-daaae64eed22` active100%, BUILD_ID
  `qjqeMZTdUN98Tz752z8Mr`; released2026-11-04T05:07:13.584676Z.
- Fresh342 tests/all native/browser/build gates pass. Production smoke confirms
  private APIs403 and anonymous external navigation remains gated, not bypassed.
- Authenticated production spreadsheet flow remains unverified. No migrations,
  manual game/DB/cron/notification operations.
