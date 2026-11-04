# Profile Redirect Confirmation

- User reports spreadsheet links still fail after the user-activation exception.
- Previous regression covered only direct links and HTTP302, not HTML/JS relays.
- Actual local Chromium requests after meta-refresh or delayed location.replace
  lose Sec-Fetch-User; current profile policy returns the wrong denied-account UI.
- This reproduces a remaining failure mode, not the user's exact Google flow.
  Ask whether the actual screen is still the same; never inspect session cookies.
- Keep paid-API policy, allowlisting and activation requirement unchanged.
- Authorized top-level non-speculative external documents without activation get
  a confirmation link. An explicit same-origin click starts normal loading.
- Never prefetch/auto-refresh this link; preserve validated profile/tab/filters.
- Non-document/fetch/iframe/speculative requests get a navigation-specific
  explanation, not a false account-permission failure. No upstream/queue work.
- Verify actual browser meta-refresh/JS relay followed by confirmation click,
  zero initial spend, denied/anonymous access, API protection, URL preservation.
- Run full tests/native/build/layout gates. Local only; no commit/push/deploy.

## Results

- Before-fix real-page regression confirms relay headers still render account
  denial; after fix both actual Chromium meta/JS relays show confirmation.
- Zero initial upstream calls/queued tasks. Native same-origin confirmation
  preserves assessment/tab/filter URLs and opens the authorized profile.
- Native link/action remains visible and usable at1440/1024/375px with compiled CSS.
- Fresh343 tests, lint/types, native D1/PNG, Worker build/scrub, audit-layout and
  complete offline profile-budget/browser gates pass.
- No production changes, commits or live game calls.
- Open: user's actual failure screen/Google relay headers not captured;
  do not claim the user's spreadsheet issue is fixed.

## Completed Rollout

- User approved commit/push/deploy after the local follow-up report.
- Fresh343 tests/all native/browser/build gates pass; code `c31762f` pushed.
- Reviewed scrubbed Worker deployed: `11f564b9-1978-4924-936b-21a79be6589d` at100%,
  2026-11-04T05:28:58.324768Z. BUILD_ID `39GOGC1r4D2eNArou8sZr`.
- Home/login200, BUILD_ID match, protected APIs403 and anonymous relay/direct/
  iframe-metadata access gates verified05:29UTC.
- No DB migration, manual DB/auth/allowlist writes/game ingestion/cron/notifications.
- Release notes recorded for push. Actual authenticated spreadsheet flow and
  production confirmation remain unverified; do not claim the user's issue solved.
