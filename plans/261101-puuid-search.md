# PUUID Player Search

- Accept name#tag or UUID-format PUUID in home/nav search.
- Resolve PUUID directly through HenrikDev account-by-PUUID v1, then use the
  existing profile pipeline without an extra name lookup or redirect deadline.
- Reuse the current profile URL and all tab/filter paths. Keep the original
  shared 8s budget, access gating, stale cache and typed unavailable states.
- Track explicit PUUID search intent by PUUID; store the resolved Riot ID only
  when the searched profile actually renders. Direct visits remain unrecorded.
- Keep Riot ID tracker.gg popups; PUUID searches stay local rather than send an
  unresolved UUID to tracker.gg or make an extra account call for a popup.
- Reject malformed/mismatched identities. No DB migration or notifications.
- Verify parsing, provider mapping/errors, history intent, actual page/browser,
  full tests, lint/typecheck and Worker build.
- User approved official docs and at most three provider reads for the supplied
  PUUID. Do not exceed that limit. Commit/push/deploy now approved.

## Verification
- One provider read used; SDK resolved the supplied ID in 819ms.
- Home/nav browser and real page/data/HTTP checks pass; UUID identity resolves
  once and all tab paths retain the UUID. Existing unavailable/timeout cases pass.
- Large-cache failure isolated to 300ms read deadline under host contention
  (311ms), followed by expensive deep-equality error formatting. Codec unit now
  controls its deadline timer; real codec/row equality and separate deadline
  verification remain. No production timing changes.
- Final 259 tests, lint/typecheck, Worker build/compat guard and scrub pass.
- Offline stalled optional source: 8,082ms; stale snapshot: 38ms. No API calls
  outside the one approved live identity read.

## Rollout
- Shipped in 80c68c0, Worker 16237370-c067-46d5-ad8d-a6589f01b9df, alongside
  recovery/phase logging (262 tests). Anonymous UUID and Riot routes retain auth.
- User confirmed continued profile timeout, now attributed by the new logs to
  access verification; this is separate from identifier parsing/resolution.
- See `261101-frequent-profile-timeouts.md` for the auth-schema fix.
