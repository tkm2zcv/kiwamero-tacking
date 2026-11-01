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
- [ ] Run full checks and review; request separate rollout/real-message approval.

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
- With this pin and compiled modules, native actual 880x660 PNG generation passed
  (shell d3c617, typecheck was finishing). Then enhanced /file to attach the REAL
  generated PNG via buildAttachmentPayload, and inspect multipart PNG signature,
  size >1000, image attachment URL and filename. This final enhancement is running.
- Gate uses actual src/worker.js initialization with only OpenNext fetch/DB entry
  boundaries stubbed, and explicit real CompiledWasm modules in Miniflare.
- Current full `npm run check` -> build:worker -> scrub process: shell de1355.
  Logs .tmp/watch-image-check.log and .tmp/watch-image-worker-build.log.
  It also saves local .tmp/watch-worker-card.png when native probe succeeds.
- Pending: read full results, validate Wrangler dry-run really bundles custom
  worker's WASM imports (OpenNext build alone doesn't bundle that wrapper), test
  Node renderer/party layout if needed, update docs, request reviewer/deploy/new
  image notification approval. No commit/push for this new fix yet.
- Current production remains ca1bdd98-149e-4d96-a70e-0f3da7c2739a from c7cb0cd,
  docs commit e61f4e0. Its five deliveries were HTTP success only, image unverified.
- Do not touch unrelated IDE active src/components/tracker/analytics-tab.tsx;
  target app is kiwamero-tracking/, not the older root app.

## Latest Evidence And Approval
- Final ac2039 full check passes 264 tests/lint/type/native/Next and Worker
  build/compat/scrub. Wrangler dry-run passes 3302.22KiB gzip.
- Node direct actual PNGs: solo880x660, party880x776. Native PNG and multipart
  pass with real production fonts replayed offline (abb2f1).
- Approved THREE Google reads USED: CSS422 bytes/two blocks; two full TTFs
  5,703,608 / 5,698,616 bytes. Old4MiB reproduces fonts-unavailable. No more
  Google reads authorized/needed. Ledger .tmp/watch-font-approved-requests.json.
- New guard: 8MiB/font, max2, CSS16KiB, header+body bounds, manual redirects;
  guard unit test added. Font error retains cause/count for diagnosis.
- Successful delivery counters imagesSent/embedFallbacks added, with unit asserts.
- Latest fresh lint/type/264 tests/real-font-native after error-cause tweak is
  shell594656. Previous whole build already passed; deploy rebuilds/scrubs anew.
- User SELECTED "反映と監視1回確認": approve commit/push/deploy after checks/review,
  then ONE normal monitoring cycle including necessary provider reads and NEW
  messages only. No resets, no replay of earlier five. New cycle NOT USED yet.
- Review follow-up withdraws subset-fanout concern based on measured fixed-UA
  CSS; no blockers. Cause-preserving throw and font-count detail implemented.
- Source/docs still uncommitted; production remains ca1bdd98. Update this state
  after commit/deploy and ONE cycle; never retry an uncertain POST without approval.
