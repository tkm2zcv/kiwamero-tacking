# Watch Notification Investigation

## Scope And Approval
- User reports monitoring does not work.
- Approved: read-only Cloudflare settings, D1 and Worker logs.
- Approved provider comparison: at most two reads for one watched player,
  differing only in region case. Both reads have now been used.
- Initial diagnosis had no manual cron, message, production DB mutation or deploy.
- User subsequently approved a separate read-only agent review, commit/push,
  production deployment and ONE normal watch cycle, including required provider
  reads and delivery to the already-configured Discord destination (five targets).
  No additional standalone provider probes or second manual cycle authorized.

## Evidence
- Five watched players, all with stored PUUID/region and a configured canonical
  webhook. Every notification cursor and timestamp is null.
- Current production Worker: 071ca9c7-9865-4708-b517-79609c2de338.
- Remote schedule is `* * * * *`; source runs watch on UTC minute zero before
  the minute audit cycle. Cron/API-key secret names are present.
- API region hypothesis rejected: stored `AP` and lowercase `ap` both returned
  HTTP 200 and one match for the same watched player, using size=1.
- Historical observability query returned 403; do not elevate access.
- Sanitized live tail is shell 785311, writing ignored local
  `kiwamero-tracking/.tmp/watch-production-tail.ndjson`.

## Investigation
- [x] Confirm registrations and webhook presence without exposing secret URLs.
- [x] Check deployed schedule/version and reject region-case hypothesis.
- [x] Observe normal hourly watch result, without triggering notifications.
- [x] Trace actual failure through fetch, match parsing, rendering or delivery.
- [x] Reproduce the confirmed defect and implement a focused regression fix.
- [x] Run tests/lint/typecheck/Worker checks and document remaining limitations.
- [x] Request approval before production deployment or notification tests.

## Confirmed Cause
- Normal 2026-11-01 16:00 UTC hourly run (no manual invocation) returned HTTP 200
  but checked five players, sent zero messages, and recorded exceptions:
  `Invalid redirect value ... "error" won't be implemented ... at the edge`.
- Earlier security hardening used `redirect:"error"` in actual webhook delivery,
  card icon and font fetches. Workerd rejects the option before sending.
- Changed these three call sites to `redirect:"manual"`. Existing `res.ok` checks
  reject 3xx, preserving the no-follow/credential-exfiltration protection.
- Baseline before this fix: 263 tests, lint/typecheck pass. Matching local keys
  correspond to all four production quota buckets. Archived real roster generates
  a notification summary successfully. No additional provider calls authorized.
- Deployment and the single real-cycle verification remain pending final checks.

## Local Verification
- Native workerd probe passes: real JSON and multipart fetches, icons/fonts and
  302 rejection, with external networking entirely replaced at the I/O boundary.
- `npm run check` and deploy now require that native regression.
- Final `npm run check` passes after the alias fix: 263 tests, lint, typecheck,
  native workerd regression and Next build. Worker build/compat/scrub also pass.
- Independent read-only review completed; no remaining blockers after canonical
  Discord alias normalization. Native probe exercises the alias-to-canonical path.
- Native regression also fails with the original `error` option reintroduced only
  in memory; the product files were untouched by that negative-control check.
- Low-priority follow-ups remain: font-CSS/wasm loader redirect/size hardening
  and a webhook transport deadline. They predate this defect and do not permit
  webhook payload redirects; keep them out of this focused delivery correction.
