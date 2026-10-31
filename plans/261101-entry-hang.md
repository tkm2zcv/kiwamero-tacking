# Entry Request Hangs

## Evidence
- Live anonymous HTML requests intermittently receive no headers for 8-12s.
- Same URLs succeed in 20-80ms; auth/session API and static assets remain fast.
- Worker tail: canceled HTML invocations, ~10ms CPU, wall 42-103s and waitUntil
  warnings. No provider fetch is needed to reproduce.
- OpenNext 1.20.13 has a request-local module-loading CacheSignal patch.
  Its AST rule only matches `new CacheSignal()`, but Next 16.4.3 constructs
  `new CacheSignal(null)`. Real deployed bundle retains the global signal.

## Work
- [x] Read README/instructions and inspect live HTTP/browser/Worker evidence.
- [x] Preserve constructor arguments in the existing adapter patch in memory;
  do not edit installed packages or application authentication behavior.
- [x] Verify real Next module request isolation and legacy constructor support.
- [x] Verify generated Worker signal scoping; fail builds when patch is absent.
- [x] Run tests/lint/typecheck/build and review diff (247/247 tests).
- [x] Obtain approval for production rollout; repeat live/browser checks.

## Rollout Evidence
- Code `47a01f5`; Worker `93e54639-51e6-4fca-a3f8-84a6a33c0b18`.
- 40/40 anonymous page requests pass, 27-1,335ms, zero timeouts.
- Normal root/login desktop/mobile Chrome: 6/6 visible sign-in pages,
  75-343ms; zero app runtime errors. New-version tail samples show no exceptions
  or cancellations; API access gates remain intact.
- Analytics-only CSP warnings remain intentionally blocked, not hidden or fixed
  by weakening policy. Authenticated profile/provider latency remains outside
  this entry-render verification.

## Scope
- No new timeouts as a substitute for resolving cross-request timer ownership.
- No DB migration, data deletion, credentials changes, OAuth or manual webhooks.
