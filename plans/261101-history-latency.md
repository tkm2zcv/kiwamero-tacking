# History Latency Stability

## Evidence
- User approved at most ten provider reads; ten used, no production DB writes.
- Real account: 2,954 stored matches. Cold pipeline 4,099ms, HTTP-cache warm 2ms.
- Second cold profile: 2,199ms; complete snapshot 2,138,613 bytes.
  Existing 1.8MB raw limit discarded the snapshot on every visit.
- Native gzip: 229,346 bytes in 22ms, retaining all rows.
- HTTP client checks inflight before valid memory cache, allowing a slow
  fresh/background refresh to block interactive readers despite usable data.

## Changes
- [x] Native compressed snapshots; 1.8MB encoded / 8MB decoded limits.
- [x] Bound memory to 8MB encoded, retain capture timestamps and all rows.
- [x] Serve valid memory hits before joining refreshes; fresh callers still join.
- [x] Test large/corrupt/expired snapshots, size guards and cross-isolate reuse.
- [x] Re-run latency/browser checks, lint, typecheck and Worker build.
- [x] Review, obtain rollout permission, deploy and record verification scope.

## Boundaries
- No invented empty history, truncation, auth relaxation or schema changes.
- First-time fresh data still depends on provider/network availability.

## Verification
- 251/251 tests, lint/typecheck, Worker build and bundle scrub pass.
- Offline browser: one stalled provider source displays measured data in
  8,088ms; valid stale profile returns in 27ms without provider calls.
- Deployed code `6774aa4`, Worker `ec3e8f57-aac3-4fa0-b59d-8260a6407c92`.
- All five approved additional provider reads used. Real 2,954-row profile:
  snapshot retained, cold local server pipeline 2,682ms, cached revisit 20ms
  with no additional requests. This is live-provider/local-server measurement,
  not authenticated production browser timing. Anonymous live smoke passes.
