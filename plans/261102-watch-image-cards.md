# Restore Image Watch Notifications

## Requirement And Limits
- User expects the previously implemented PNG-card notification, not only embeds.
- Prior verification proved five Discord HTTP successes and saved cursors, not
  that those messages contained generated PNGs. The previous native probe used
  a four-byte attachment fixture and did not run the image renderer.
- Initially no additional notification/deployment approved; latest approval below.
- User additionally approved official npm/docs reads and local dependency update,
  initially excluding rollout. Subsequent always-on rules explicitly requested
  code review; read-only reviewer 2648a465 found no blockers.

## Evidence
- Production source calls renderWatchCard, falling back to embeds on null/error.
- Public /resvg.wasm returns 200, correct MIME and WASM magic, 2,478,606 bytes.
- Satori's own README says its default build dynamically loads base64 WASM,
  which Cloudflare restricts; it recommends standalone with supplied modules.

## Steps
- [x] Confirm original card path and current fallback behavior.
- [x] Reproduce full PNG rendering in real workerd without external requests.
- [x] Fix confirmed runtime initialization at its source, preserving Node use.
- [x] Verify actual PNG dimensions/content and image multipart payload.
- [x] Run full checks and review; request separate rollout/real-message approval.

## Root And Local Changes
- Expanded tools/check-watch-worker.cjs to call real renderWatchCard with a real
  installed Geist TTF at the outbound font boundary, NOT four fake font bytes.
  Original renderer returned null with `Wasm code generation disallowed by embedder`
  at resvg initialization. Reproduction log: .tmp/watch-image-reproduction.log.
- Worker entry now imports compiled @resvg/resvg-wasm/index_bg.wasm and the Satori
  layout module, exposes them as globalThis.__kiwameroWatchWasm. Renderer uses
  satori/standalone, independent cached engine initialization, Node disk fallback.
  No runtime WASM download/compilation in Workers; no altered card tree/styles.
- Satori 0.60.3 standalone also eagerly initializes bundled harfbuzzjs and fails
  on missing self.location.href in real workerd. Official npm tarballs confirmed
  latest 0.63.2 has the same eager HB factory. Do not spoof global locations,
  enable unsafe compilation, patch node_modules or hide the failure.
- With user-approved dependency update, pin Satori exactly 0.32.0: newest official
  release without eager HarfBuzz; exports standalone init accepting compiled
  WebAssembly.Module and satori/yoga.wasm. package.json/lock updated by
  npm install --save-exact satori@0.32.0 --ignore-scripts --no-audit --no-fund.
- Native gate generates real 880x660 PNGs and attaches them via
  buildAttachmentPayload, checking signature, size, attachment URL and filename.
- Gate uses actual src/worker.js initialization with only OpenNext fetch/DB entry
  boundaries stubbed, and explicit real CompiledWasm modules in Miniflare.
- Do not touch unrelated IDE active src/components/tracker/analytics-tab.tsx;
  target app is kiwamero-tracking/, not the older root app.

## Latest Evidence And Approval
- Full check passes 264 tests/lint/type/native/Next and Worker
  build/compat/scrub. Wrangler dry-run passes 3302.22KiB gzip.
- Node direct actual PNGs: solo880x660, party880x776. Native PNG and multipart
  pass with real production fonts replayed offline (abb2f1).
- Approved THREE Google reads USED: CSS422 bytes/two blocks; two full TTFs
  5,703,608 / 5,698,616 bytes. Old4MiB reproduces fonts-unavailable. No more
  Google reads authorized/needed. Ledger .tmp/watch-font-approved-requests.json.
- New guard: 8MiB/font, max2, CSS16KiB, header+body bounds, manual redirects;
  guard unit test added. Font error retains cause/count for diagnosis.
- Successful delivery counters imagesSent/embedFallbacks added, with unit asserts.
- Fresh594656 passes lint/type/264 tests/real-font-native after the cause tweak;
  deploy also rebuilt/compat-verified/scrubbed successfully.
- User SELECTED "反映と監視1回確認": approve commit/push/deploy after checks/review,
  then ONE normal monitoring cycle including necessary provider reads and NEW
  messages only. No resets, no replay of earlier five. Approval is now USED.
- Review follow-up withdraws subset-fanout concern based on measured fixed-UA
  CSS; no blockers. Cause-preserving throw and font-count detail implemented.

## Final Production Result
- Commit a6e97f4 pushed; deployed91352c68-a2bb-4adf-a5bd-257d4b3f1e91.
- Approved ONE normal cycle is USED (ledger .tmp/watch-image-real-cycle-start.json).
  POST17:37:11.844 UTC, HTTP200,53,808ms, checked5, processed3, sent1,
  imagesSent1, embedFallbacks0, webhookFailures0.
- Residual: TWO match fetches returned providerHTTP502. No cursors advanced for
  those failures, no extra probes/retry/manual cycles. Next regular cycle retries.
- D1 read confirms exactly one timestamp updated since cycle start,
  latest2026-11-01T17:38:06.411Z. Prior five not replayed/reset.
- Root/login/watchlist200; anonymous stats and cross-site watchlist API403;
  CSP/frame protections retained. No raw SQL production write/migration.
- Actual Worker PNG payload HTTP acceptance and persistence verified; recipient
  visual inspection not observed. All five healthy is NOT verified.

## Approved Past-Three Backfill Test
- After a sixth entry appeared, user explicitly selected the ORIGINAL five only
  and approved advancing notification records. Scope: up to 15 messages; the new
  sixth entry is untouched and remains unnotified.
- Used `.tmp/send-watch-backfill.mjs`: read last-three archived match payloads,
  replayed cached approved fonts (zero new Google/provider reads), allowed only
  public icon hosts and Discord POSTs, rendered the same card code, multipart
  sent, and persisted records after each success. Attempt ledger prevents rerun.
- Dry run loaded all 15 payloads and rendered an 82,241-byte PNG. Actual run
  17:56:16-17:57:55 UTC sent 15/15 image messages; failures 0; PNG sizes
  38,012-137,009 bytes.
- Read-only D1 confirmed final `lastNotified*` values for the original five and
  null cursors/fields for the sixth. This controlled sender is not evidence that
  the next hourly Worker cycle completed; that remains for normal observation.
