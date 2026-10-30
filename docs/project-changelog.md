# Project Changelog

## 2026-10-30 — Shared Henrik budgets and historical enrichment (not deployed)

- Added atomic D1 rolling quotas/cooldowns across configured keys and isolates:
  default30/key/min, background20; optional shared provider/account scope.
  Honor Retry-After, cool bad credentials, preserve403 privacy failures.
- Persistent ended-match roster/stat archive with shared token leases, validated
  cache admission, bounded backoff and explicit unavailable records.
- Public opt-in, deduplicated history manifests; atomic global admission,
  conditional resync, crash recovery and priority for suspicious-period context.
  Minute audit cron is separate from still-hourly watch notifications.
- Scan every20+20 boundary, not only lifetime halves. Reject mixed-rank/future
  evidence; show per-period archived/pending/unavailable coverage and provisional
  conclusions. Browser utilities no longer import the DB-aware API layer.
- Local-only additive migration applied. No deployment, production DB/secret
  changes, live bulk ingestion, notification execution, commit or push.
- Verification/limitations: `reports/20261030-history-queue-review.md`.
  140 tests, lint/typecheck, Next/OpenNext builds; EN/JA1920/390/360px,
  pending/partial UI fixtures, local route guards, clean client secret/DB scan.
  This entry supersedes the previous24h-cache/no-backfill statements below.

## 2026-10-30 — Report logic review and tracker.gg-style report UI (not deployed)

- Corrected false suspicion from empty/missing data, sample/scope mixing,
  rename-based identity, draws, duplicate rosters and unordered opponent ranks.
- Removed uncalibrated probability/P95/90%-CI/cheating claims. Scores are
  descriptive indices; unavailable scores and reference ranks are null.
- Reports explicitly use account-wide Competitive data. Audit requires 40 valid
  stored rows; diagnosis needs 10 valid rosters and 5 decided games from the
  latest 25 matches within 90 days. Hidden ACT/mode filters cannot mislead users.
- Audit no longer fetches historical rosters. Diagnosis tops up only a missing
  minimum, at most 10 match IDs, retaining the 24h detail cache.
- Canonical agent-role mapping now includes Hush and correctly classifies Veto;
  unknown primary roles withhold the model. Missing stats/shots stay unavailable.
- Rebuilt both tabs using existing tracker.gg tokens, Saira headings, v3 cards,
  score tiles, striped tables, a 300px summary rail and mobile-first reading order.
- Verification: 116 tests, lint/typecheck, Next and OpenNext builds; live Meiy and
  ashrielle checks, EN/JA, 360/390/1440/1920px, methodology keyboard interaction.
- Details/formulas/limitations: `reports/20261030-account-report-review.md`.
  Earlier report claims in the initial implementation entry are superseded here.

## 2026-10-30 — Search history (anonymous, localStorage)

- `src/lib/search-history.ts`: stores the last 10 viewed profiles
  (`name#tag`, puuid, player-card + rank-icon URLs, timestamp). Dedupes by
  puuid (rename-safe) or case-insensitive name#tag; tolerant of corrupt
  storage and private-mode failures.
- `ProfileViewRecorder` (client) mounted on the profile page records the view
  — so history only ever contains real, successfully-rendered profiles,
  regardless of entry point (search box, direct link, cross-player links).
- `RecentSearches` (client) renders a "検索履歴 / Recent searches" chip strip
  under the homepage search box (card thumbnail + name#tag + rank icon),
  with a Clear button. Empty history renders nothing; deferred `setTimeout`
  read avoids hydration drift and the `react-hooks/set-state-in-effect` rule.
- i18n: `search.recent` / `search.clear` (EN + JA).
- Verified E2E (Puppeteer): two profile views → chips appear newest-first on
  the homepage. 94 tests green including `tests/search-history.test.ts`
  (dedupe, cap, corrupt-storage, no-window paths).

## 2026-10-30 — Account Audit & Smurf Diagnosis implemented for real

- Both tabs were stubs (audit = facts table, diagnosis always empty). They now
  share one `AccountReport` computed server-side, reproducing the report
  structure observed on the reference site (`docs/research/extracted-initial-audit.json`).
- New libs: `report-model.ts` (shapes), `report-evidence.ts` (cluster stats,
  lifetime genealogy, early-vs-recent comparison, per-act history from
  stored rows), `audit-score.ts` (アカウント査定: 0-100 ownership-change
  score, grade S/A/B/C, breakdown rank/server/performance/activity, signals),
  `rank-benchmarks.ts` (per-band×role mean/p95 heuristics), `lobby-analysis.ts`
  (competitive roster sampling, band z-scores, opponent tier distribution,
  precision-weighted MLE true-rank estimate with 90% CI), `smurf-verdict.ts`
  (smurf/alt/cheat scores + verdict label + benchmark comparison).
- Roster coverage: the page fetches `/v2/match/{id}` for up to 50 uncovered
  competitive stored rows (`REPORT_DETAIL_CAP`, batches of 10, 24h-cached)
  plus the recent v3 set; audit evidence itself is always lifetime stored
  history and needs no details.
- Cluster names now normalize the "City N" shard suffix (`normalizeCluster` in
  henrikdev.ts) so "Tokyo 1" counts as Tokyo — fixes false server-relocation
  signals in the audit and gives "Tokyo 1" match rows the flag chip.
- `StoredRow` gained `selfName`/`selfTag`/`level` for rename detection.
- Verified locally on real data (Meiy#B3L, ashrielle#4sh) in EN+JA: Meiy →
  audit 0/C "almost none", verdict Fair player, est. Radiant (high);
  ashrielle → Sentinel baseline detected, est. Silver 2 vs Silver 3 rank.
- `npm run check` green — 91 tests incl. `tests/account-report.test.ts`
  (clean/smurf/flip/rename/insufficient/history cases).

## 2026-10-30 — Encounters across every act via on-demand match details (deployed)

- The encounters tab previously only counted the recent v3 matches
  (`visibleMatches`), so players met in older acts never appeared. HenrikDev's
  stored-matches endpoint carries no rosters, so the tab now fetches
  `/v2/match/{id}` for each stored match in the selected act that isn't
  already covered by the recent response — deduped via
  `selectUncoveredMatchIds` (newest first, `ENCOUNTER_DETAIL_CAP = 150`),
  fetched in `Promise.allSettled` batches of 10 so individual 404/429s are
  skipped. Details are immutable and cached 24h, so coverage grows on
  revisits; a notice states "computed from N of M matches" when partial.
- Works for every act selector (`season=e11a5`, `season=all`, `latest`,
  UUID) and respects the playlist filter implicitly — `storedScoped` is
  already act+mode-scoped upstream.
- Verified on production (Version 487d1f58): ashrielle#4sh `season=e11a5`
  → "59 of 199 matches" in ~15s with real historical players
  (Zackmailer#TKS, Arcturus#5340 in Played With); `season=all` locally
  → "116 of 664" with cached carry-over.
- Tests: `selectUncoveredMatchIds` covers recent-dedup, newest-first order,
  cap, and missing-id skips (85 total passing).
- Follow-up (Version 9f1ec16f): `season=all` now scopes detail fetches to the
  **two most recent acts** (picked by latest `startedAt` per `seasonId`)
  instead of the whole history — a cold visit no longer burns the upstream
  quota on old encounters. Specific-act selections still fetch that whole
  act. The coverage note for `all` reads "the two latest acts — pick a
  specific act for older encounters". Verified on production:
  `season=all&playlist=all` → "92 of 419" (was "of 664").

## 2026-10-30 — Server-country chip on match rows (deployed)

- Match rows and the expanded match header now show the VALORANT server
  (`metadata.cluster`) as flag + city name next to the placement badge —
  e.g. 🇯🇵 Tokyo, 🇵🇭 Manila, 🇦🇺 Sydney.
  `StoredRow`/`storedRowToMatch` now carry the cluster so stored-history rows
  show it too. Cluster→country map covers AP/NA/LATAM/EU/KR cities; unknown
  clusters fall back to the raw name without a flag. Flags come from flagcdn
  (plain `<img>` — no next/image domain config needed).
- `.build-tmp` (project-local TMPDIR used to dodge Windows %TEMP% write blocks
  in esbuild/workerd) added to .gitignore and eslint ignores.
- The match-row timestamp is now `M/D HH:mm` (`10/28 08:57`) instead of a
  relative "2d ago" (`formatMatchTime` in profile-stats).
- The row's trailing ⋮ became an external-link icon that opens the match on
  tracker.gg (`tracker.gg/valorant/match/{id}`, `stopPropagation` so it does
  not toggle the drawer).
- Verified on production (Version e452aa93): Tokyo chip, datetime format,
  tracker.gg links all live on recent and stored rows alike.
- Polish (Version e381f569): flag images are contained in the chip via a
  `.v3-flag` class — the generic `.v3-chip img` rule forced a 1rem square with
  negative margins that overflowed the chip. The day-header's trailing ACS
  stat is inset `0.75rem` from the card's right edge.
- Fix (Version cb198cff): HenrikDev v3 sometimes returns `cluster: null` for
  matches whose stored-history row has the real server (seen on ashrielle#4sh,
  a multi-cluster player). The list merge now back-fills an empty v3 cluster
  from the stored row of the same match so the chip shows there too.

## 2026-10-30 — On-expand full scoreboard + 20/page + tracker.gg parity columns (deployed)

- High: expanding any match row — including stored-history rows that carry only
  self stats — lazily fetches the full 10-player scoreboard from a new public
  route `GET /api/valorant/match/[id]` (HenrikDev `/v2/match/{id}` normalized via
  `normalizeHDMatch`). The endpoint is IP rate-limited and upstream responses
  are cached 24h since finished matches are immutable; a "Loading scoreboard…"
  line shows while the first fetch is in flight and cached expands render
  near-instantly. Verified on production: stored row expand → 200, 10 players.
- Medium: the expanded scoreboard now matches tracker.gg's match report — a
  match header (mode · map · A:B score · date · duration · average rank) plus
  per-team tables with columns Match Rank, ACS, K, D, A, +/-, K/D, DDΔ, ADR,
  HS%. Team tables show their round score next to the label.
- Medium: collapsed match rows and the day-group header gained an ADR column
  (DDΔ · ADR · HS% · ACS order, same as reference). The list grid gained one
  `min-content` track. Match pagination is now 20 rows per `?page=`.
- Verification: 84 tests, lint, typecheck, Worker build; deployed
  (Version a78f12cd). 679-match profile → Page 1/34, last page 19 rows, all
  reachable. Build/deploy needed a project-local TMPDIR — Windows refused
  esbuild/workerd writes to `%TEMP%` during this session.
- Note: TRS/KAST/FK/FD/MK are tracker.gg-proprietary or not derivable from the
  normalized data and are intentionally absent. "ACD" does not exist in the
  reference UI — the intended columns (ACS/ADR/HS%) are all present.

## 2026-10-29 — Act selector fix + Encounters party semantics (deployed)

- High: Overview stats (ADR/K-D/HS/Win tiles, W/L donut, match count) now come
  from the act-filtered stored match history instead of the 25 most recent v3
  matches and the always-current-act MMR totals. Selecting a past act previously
  showed zeroed tiles plus the current act's donut; it now shows that act's real
  aggregate (verified on production: e10a1 → 134 matches / 64W-46L / K-D 1.40).
- High: Encounters "Played With" now counts premade party members identified by
  HenrikDev `party_id`, not every same-team player. Same team + different party
  no longer counts; `played_against` unchanged.
- Playtime is omitted on the Overview header when act-scoped stored stats are
  used (stored history has no match duration); the match count is the act total.
- High: the match list now merges every stored-history row into the match tab
  (`storedRowToMatch` self-stat pseudo-matches) so all matches across all acts
  are listable. The matches tab paginates server-side via `?page=` (500 rows per
  page, Newer/Older links) so every match stays reachable while the RSC payload
  stays bounded; verified on production (679-match profile → page1 499 + page2
  179 unique ids, zero overlap). Recent v3 matches keep their full
  roster/scoreboard; stored-only rows render self stats and hide the placement
  badge (single-player roster). A draw is now detected when neither team won
  instead of being shown as a loss (`wonMatch`).
- Encounters remains recent-roster-only for past acts (full rosters are only in
  the recent matches endpoint); per-match detail (`/v2/match/{id}`) exists
  upstream but costs one call per match — viable for an on-expand fetch later.
- Verification: 82 tests, lint, typecheck, Worker build; deployed and verified
  on tracking.kiwamero.dev (all → 2909 matches lifetime totals).

## 2026-10-29 - Review fixes (local, not deployed)

- High: notification batches now drain the oldest unseen matches first; advancing
  the cursor no longer permanently skips older matches when a batch exceeds five.
- High: profile loading classifies recent/stored history, MMR and MMR-history
  failures instead of converting quota/private/upstream errors to empty data.
  A genuine history 404 remains empty; empty samples count as zero matches.
- High: preserve `currenttier_patched` and correct Riot tier division numbering.
- Medium: admit watched players in one conditional INSERT/UPSERT so concurrent
  registrations cannot exceed 100 distinct players. No schema migration required.
- Medium: remove implicit subscriber row limits before player deduplication.
- Medium: Account Audit labels statistics as a recent retrieved sample, not
  lifetime totals; the seed fallback also recomputes its sample summary.
- Medium: Encounters shares the Act/playlist filtering used by match history;
  Act and Played Against links preserve each other's query state.
- Medium: initial locale uses quality-ranked Accept-Language, with a valid
  explicit language cookie taking precedence.
- Verification: 81 tests, lint, typecheck, Next production build and OpenNext
  Worker build passed. Local HTTP smoke checks used an isolated fixture upstream
  (no real API calls or webhook sends): locale/cookie precedence, audit labels,
  encounter filter URLs, rate-limited/private unavailable states.
- Deployment, real Discord login and real webhook delivery were not performed.

## 2026-10-28 — 監視通知の実装 / テスト / Workers 検証 (docs 完走)

`docs/` に残っていた未完了項目を通した回。UI は前回の実測リビルドのまま。

### 監視通知 (R-07 / Phase 6b)
- Prisma スキーマに `User.webhookUrl` / `User.webhookUpdatedAt`、
  `WatchlistEntry.region` / `lastSeenGameStart` / `lastNotifiedMatchId` / `lastNotifiedAt`
  と `(riotName, riotTag)` インデックスを追加。
- `src/lib/watch-core.ts` — 純関数 + DB 非依存の `runWatchCycle`:
  Webhook URL 検証 (discord.com のみ・トークン長・資格情報拒否)、難読化表示、
  初回は最新1試合 / 以降は `game_start` 差分 / 1回5件上限、システム全体100人上限、
  プレイヤー単位で HenrikDev 照会を共有、送信失敗時はカーソルを進めない。
- `src/lib/watch-run.ts` — HenrikDev と fetch を注入する実運用結線。
- `POST /api/cron/watch` (`Bearer CRON_SECRET`、開発時のみ認証不要) と
  `GET` ヘルス。`src/worker.js` の `scheduled` + `wrangler.jsonc` の
  `triggers.crons = ["0 * * * *"]` から毎時実行。
- `/api/watchlist/webhook` (GET/POST/DELETE) と `/api/watchlist/webhook/test`。
  保存直後に監視中プレイヤーの直近1試合を送信。URL は画面・API に再表示しない。
- `/watchlist` に Webhook 設定 UI (保存/置換/削除/テスト送信/状態表示) を追加。
  監視対象一覧にリージョンと最終通知時刻を表示。
- `POST /api/watchlist` は 100 人上限を超える新規追加を 409 で拒否。
- ローカル D1 と SQLite に増分マイグレーションを適用
  (`prisma/d1/upgrade-2026-10-28.sql`, `tools/migrate-dev-db.mjs`)。

### テスト
- `node --test` (Node 24 の型ストリップ) で 34 件。`npm test` / `npm run check` を追加。
- 対象: Webhook 検証・新着判定・Embed・上限、監視サイクル (初回/2回目/差分/失敗時の再送/
  照会共有/上限/1件失敗でも継続)、`formatAct`・Overview/Accuracy/Roles/Maps/行の集計、
  HenrikDev レスポンス正規化 (`all_players`/`map` オブジェクト/FFA/欠損)。
- 正規化は `src/lib/match-normalize.ts` へ切り出してテスト可能にした。

### Workers / デプロイ準備
- `open-next.config.ts` を追加し `npm run build:worker` で `.open-next/worker.js` を生成。
- `wrangler deploy --dry-run` 成功 (Worker 12.9 MB / gzip 3.3 MB、
  `DB`/`ASSETS`/`APP_URL`、cron トリガー)。デプロイ自体は未実施。
- `wrangler dev` でプロフィールページ 200・cron ヘルス 200 を確認。
- **判明した制約**: Prisma 7 は workerd で動かない
  (`CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder`)。
  認証・監視リスト・Cron の DB 更新は Node 専用。移行方針は
  `docs/system-architecture.md` の決定ゲートに記載 (D1 ネイティブ/Drizzle が本命)。
- Windows では OpenNext のシンボリックリンク作成が EPERM になるため、
  `tools/fs-symlink-fallback.cjs` を preload する `build:worker` を用意。

### ドキュメント
- README を現状 (スクリプト、監視通知の使い方、既知の制約) に更新。
- `docs/system-architecture.md` に監視通知の実装・Workers 制約・決定ゲートを追記。
- `.env` 例に `CRON_SECRET` を追加。

## 2026-10-27 — tracker.gg UI を実測ベースで作り直し (parity rebuild)

これまでの実装は tracker.gg の見た目から大きく外れていたため、
`https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview?...&season=d816f426-...`
を Scrapling で再取得し、**DOM の実測座標 + computed style** を仕様として UI を作り直した。

### Observe (取得)
- `tools/scrape/capture-reference.py` → StealthySession で 1920x1080 / DPR2 撮影、
  `docs/research/capture/` に `ref-1920.png` / `ref-1920-full.png` / `dom-1920.json`
  (要素ごとの rect と computed style) / `page-1920.html` / `assets.json` / `fonts.json` を保存。
- 計測ツール: `tools/scrape/inspect-dom.py` (`outline` / `find` / `path` / `cls` / `sub`)、
  `tools/scrape/landmarks-local.py` (ローカルの主要要素の rect を出力)、
  `tools/scrape/compare.py` (参照とローカルを同じ矩形で上下に並べる)、
  `tools/scrape/shoot-local.py` / `shoot-url.py` (スクショ)。

### 参照から分かった確定値
- viewport 1920 でコンテナ 1400 (内側 1392、左右 260 マージン)。hero 1392x320 / radius 16。
- タブバーは hero 下端に密着 (高さ 56、背景 `rgba(44,63,82,.9)`、左に 144px のオフセット、
  項目は 16px/500、有効タブは下辺 2px `#ff4655`)。
- 広告帯 1392x112 (728 + 632 の 2 カラム)、フィルタ行 1392x40 (5 カラム gap16)、
  本文は `300px / 1068px` の 2 カラム gap24。
- カード見出しは Saira 20px/600 uppercase、本文は Roboto。数値は 18–32px/700。
- Current Rating カード 300x225.7、Overview カード 1068x358.7 (highlighted 126、
  4 タイル 252.5x76.9、二次指標 6 列 164.3x68.9)、Tracker Score 行 1068x79.2、
  Top Agents 表 (行 56px)、Last 20 Matches カード。
- 書体は Roboto + Saira (Poppins は別領域) — 既存の next/font 構成のままで一致。

### Build (実装)
- `src/app/tracker-ui.css` を新設し、`kt-` 名前空間で上記の実測値を再現
  (globals.css の旧 `trn-` プロフィール CSS は他タブ用に残置)。
- 新コンポーネント: `hero`, `filters-bar`, `ad-strip`, `rating-card`, `overview-card`,
  `score-card`, `top-agents`, `matches-card`, `sidebar-cards` (Accuracy / Roles / Top Maps)。
- 旧 `overview-panels` / `profile-hero` / `stats-grid` / `teammates` / `match-list` /
  `match-row` / `match-detail` を削除 (未使用化)。
- `src/lib/profile-stats.ts` を追加: 試合行、命中率、ロール別、マップ別、
  Overview 集計、`formatAct()` (e11a6 → `V26: A6`) を純関数で提供。
- `site-nav` を実測値 (ゲームバー 40px / サイトナビ 56px / 検索 149.6x36) に合わせて刷新。
- データ拡張: `by_season` から現在アクトとシーズン戦績、`mmr-history` から peak RR を取得
  (`ranking_in_tier` が正で `rr` ではない点を修正)。トラッカー上部の
  `36 W / 20 L` と `56 Matches` はシーズン実績。
- 「Top X%」パーセンタイルは母集団が無いため表示しない (標本数を併記)。
  KAST / First Bloods / Flawless / Aces はラウンドデータ未取得のため `-`。

### Compare (検証)
- `docs/screenshots/parity/` に参照・ローカル・比較画像を保存。
  hero / overview / matches の 3 領域で並べて差分を潰した。
- 主要ランドマークの実測一致: hero `264,120 1392x320`、tabs `264,384 1392x56`、
  広告 `264,464 1392x112`、フィルタ `264,600 1392x40`、2 カラム `264,664 300|1068`、
  overview 本体 `589,706 1066x126`、タイル `605,816 252.5x76.9`。
- 390px 幅のモバイルも確認 (ナビ/タブ/フィルタは横スクロール、主要指標は 2 カラム)。
- `npx tsc --noEmit` / `npm run lint` / `npm run build` すべて成功。全ルート 200。

### 未対応 (意図的)
- Premier Roster カード: HenrikDev にプレミアロスターのデータが無いため非表示。
- TRS / 有料フィルタのロック、Live Update トグル、広告枠の実広告は再現せず独自要素で置換。

## 2026-10-27 — Kiwamero Tracking requirements handoff

- 新規アプリ `kiwamero-tracking/` の要件定義、技術選定、次セッション引き継ぎを `docs/` に追加。
- Cloudflare `tracking.kiwamero.dev` を公開予定先とし、Workers/D1 の互換性は未検証と明示。
- `.env` にローカル設定の枠とランダムな Better Auth secret を用意。
  HenrikDev/Discord の資格情報は未設定。`.env.example` は値なしで共有可能。
- PSTACK は Cursor/Claude Code 向け。Devin では手法のみ参考にできると記録。
- 現状の画面崩れ、誤データフォールバック、API キー管理の未完成を引き継ぎに記録。
- ヒアリングで本番 Workers + D1 固定、非公開/未収録は取得不可、
  診断は既存項目を調査再現、開発者 API は所有者専用と決定。
- 所有者は Discord ID 許可リスト、戦績カードは最新データへの URL 共有、
  言語初期値はブラウザ設定と決定。
- 監視はユーザー別 Discord Webhook、全体100プレイヤー、毎時確認、
  登録直後は直近1試合通知と決定。送信や Cloudflare 配備は未実施。
- UI は tracker.gg の VALORANT 領域全体を参照し、デスクトップを先に
  比較してからモバイルを確認する方針。未調査ページは次フェーズで棚卸し。
- 他ゲームは対象外。有料/ログイン限定機能は利用可能なデータから
  独自実装で同等の体験を提供し、制限の回避はしない。
- 初回は PC と高度な統計・比較を優先。Console や LFG/OBS/クロスヘア/
  ラインナップはデータ取得可能性を調査し後続候補とする。

## 2026-10-27 — Initial clone build

### Research (scraping)
- Scraped tracker.gg (616KB HTML, 482 CSS vars, 56 stylesheets) via Scrapling StealthyFetcher — full design tokens extracted.
- Scraped vtl.lol (4.7MB HTML, 7 stylesheets) — SvelteKit + Bootstrap 5 + Inter, bypassed Cloudflare via in-page fetch.
- Logged into tracker.valosmurf.net via manual Discord OAuth in headed Camoufox; captured tracker page, home, /developers + full embedded RSC/flight JSON (session persisted in `tools/scrape/.valosmurf-profile`, `docs/research/valosmurf-state.json`).
- Downloaded 44 static assets (29 agent icons, 14 map images, brand logo) from production public dirs.
- Analysis doc: `docs/research/tracker-sites-analysis.md`.

### Implementation
- Scaffolded Next.js 16 + TS + Tailwind v4 (App Router, cacheComponents/PPR).
- Reproduced production design tokens verbatim in `globals.css` (lab() palette, radius .5rem, Outfit/Noto Sans JP/Geist/Geist Mono).
- Pages: `/login` (Discord OAuth card), `/` (search home), `/tracker/[name]/[tag]` (hero, 5 tabs, Top Agents, teammates, stats summary, filters, expandable match cards w/ team rosters, pagination), `/developers` (APIキー/プレイグラウンド/ドキュメント tabs).
- Seed data: real production JSON — `src/data/profile.json` (profile, 15-agent breakdown, teammates, 39 season ranks, diagnosis audits), `src/data/matches.json` (20 full HenrikDev-format matches).
- Borrowed features: vtl-style expandable match detail + lobby tier range; tracker.gg-style tab counts.
- Verified: `npm run build` ✓, `npm run lint` clean, screenshot parity vs production.

## 2026-10-27 — kiwamero-tracking: 実データ接続 + Workers/D1 PoC

### 修正
- Tailwind v4 未適用を解消: `next.config.ts` の `turbopack.rules` に `@tailwindcss/turbopack` を設定。ヒーロー画像が全画面を覆う崩れも同時に解消（親の `relative` が効いたため）。
- 任意 Riot ID に Meiy シードを返す誤フォールバックを除去。`loadProfile` は `ProfileResult`（ok/reason）を返し、404→not_found、401/403→private、429→rate_limited、その他→upstream を分類。「Profile unavailable」ページを新設。
- HenrikDev 実レスポンス形状へ正規化を更新: `players.all_players`、`team` フィールド、`teams.*.has_won`/`rounds_won`、トップレベル `damage_made`、`ability_casts` オブジェクト、`season`/`tier` 欠落許容、FFA モードの `team` 無し対応。
- `m.players.map is not a function`・`season.id` undefined・`team_id.toLowerCase` undefined のランタイム例外を全て解消。
- matches fetch (12MB) が Next の 2MB キャッシュ上限を超過 → `cache: "no-store"` を適用。
- FilterSelect の key 警告・`matchid` 重複 key を修正。

### セキュリティ
- `/api/valorant/*` プロキシと `/api/keys` を所有者専用に (`src/lib/owner-access.ts`)。匿名は 403。
- APIキーは `sha256:` ハッシュ保存、発行時のみ平文返却、DELETE で失効。Bearer `kt_<64hex>` をハッシュ照合。
- エラー応答から内部例外メッセージを除去 (`upstream unavailable`)。

### Workers + D1 PoC（ローカル完走）
- 依存追加: `@opennextjs/cloudflare@1.20.13`, `wrangler@4.153`, `@cloudflare/workers-types`, `@prisma/adapter-d1@7.10.1`。
- `wrangler.jsonc`: `DB` D1 バインディング + `nodejs_compat` + `main: .open-next/worker.js`。
- `initOpenNextCloudflareForDev()` で `next dev` 内から Miniflare D1 を解決。
- `src/lib/prisma.ts` を遅延プロキシ化: D1 バインディングがあれば `PrismaD1`、無ければ `better-sqlite3` に自動切替。
- `prisma migrate diff` で `prisma/d1/schema.sql` 生成 → `wrangler d1 execute --local` で6テーブル適用。
- Bearer キーで `/api/valorant/account` を叩き、D1 でキー照合→HenrikDev 実データ返却 (200) を確認。

### 検証
- `tsc --noEmit` 0件、`npm run lint` クリーン、`npm run build` 成功（全ルート ƒ）。
- ブラウザ実スクショ: desktop 1440px（勝率80%/スコア/チームメイト実データ）、mobile 390px、404 ページ。
