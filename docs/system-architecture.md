# Kiwamero Tracking: 技術選定と構成 (draft)

対象は `kiwamero-tracking/`。これは「実装済み」と「本番推奨」を混同しないためのメモ。

## Report Boundaries (2026-10-30 Refactor, Not Deployed)

- `henrik-model.ts` owns provider DTOs/identifiers; `henrikdev.ts` is the server
  endpoint facade and retains compatible type reexports.
- `match-archive-payload.ts` is a pure validator/projector. `match-archive.ts`
  owns persistence, leases, retry bookkeeping and coalescing.
- `audit-coverage.ts` supplies pure aggregation/browser-safe DTOs; SQL stays in
  `audit-history.ts`. One completion predicate serves scoped status and global
  cron updates, including interrupted-manifest guards.
- Roster sampling/validation lives in `report-scope.ts`; `lobby-analysis.ts`
  computes model metrics. Client progress no longer imports types from storage.
- Behavior is unchanged; characterization, SQL and dependency-graph regressions
  are recorded in `reports/20261030-report-refactor.md`.

## Shared Henrik Budget / History Queue (2026-10-30, Not Deployed)

- `henrik-request.ts` reserves D1 slots via `henrik-quota.ts` before HTTP.
  Default30/key/min, background20, foreground uses the remaining capacity.
  `HENRIK_QUOTA_SCOPE=shared` applies a single account/provider budget.
  Keys are only in server environment; D1 stores hashes/counters/cooldowns.
  429 honors Retry-After, 401 cools bad credentials, 403 does not rotate.
  Transport/body errors are sanitized; unavailable storage/keys fail closed.
- `MatchArchive` persists ended-match metadata, roster and required stats.
  `getMatch` uses120s token leases to coalesce cross-isolate fills. Round/event
  blobs are omitted. Recent v3 rosters seed the same archive. Generic profile
  caching remains memory/colo TTL caching, not globally durable account caching.
- `AuditHistory` stores a bounded manifest; `AuditMatch` deduplicates shared match
  jobs. Admission is atomic (20 active players); resync uses a conditional
  update and retains older rows. Interrupted manifests are repairable.
- Explicit public POST starts enrichment after same-origin/body/IP/identity
  checks. GET polls only storage. No bulk fetching on ordinary report render.
  Cron drains <=100 candidates/cycle with a40s start deadline, bounded retries,
  cooldowns, priority for change windows, then older remaining history.
- `src/worker.js` runs minute audit cron; notifications stay hourly at UTC minute0
  and run first. Both routes use CRON_SECRET outside development.
  Large backfill assumes Workers Paid CPU/D1 query allowances.
- Audit uses adjacent20+20 windows over all retrieved Competitive rows. Rank
  coverage/spread gates prevent incompatible/mixed-rank comparisons. UTC hours
  and party continuity are context only. UI exposes provisional state, excluded
  record IDs, per-ACT/date archived/pending/unavailable coverage.
- Browser-safe rank/card/cluster utilities live in `henrik-shared.ts`; client
  components must not import the credential/DB-aware API module at runtime.
- Additive schema: `db/upgrade-2026-10-30.sql`. Only local DBs upgraded so far.
  Provider quota independence, retention policy and production costs remain
  rollout gates. Review: `reports/20261030-history-queue-review.md`.

## Private Access Control (2026-10-31, Not Deployed)

- Every UI page calls `getSiteAccess()` before loading profile/search data. Anonymous
  visitors receive the in-site Discord sign-in gate; signed-in Discord accounts not
  present in `OWNER_DISCORD_IDS` receive a dedicated "not registered" state.
- `owner-access.ts` now separates the human allowlist check
  (`allowedDiscordAccess`) from API-key auth (`resolveOwnerAccess`). Watchlist APIs
  accept only allowlisted Discord sessions; `/api/valorant/*` accepts either an
  allowlisted session or a valid `kt_` key. Cron stays under `CRON_SECRET`.

## Share Card Rendering (2026-10-31, Not Deployed)

- `share-card-data.ts` builds the serializable card model server-side: identity,
  current rank, current-act rows and the selected playlist. It never substitutes
  lifetime or older-act totals for an explicit current-act scope.
- `share-image.ts` renders a 1400×700 Canvas PNG in the browser. Remote rank/card
  assets pass through the configured `/_next/image` host allowlist; failed assets
  degrade to text-only sections instead of tainting or blocking the canvas.
- `ShareProfileButton` opens a Kiwamero-styled dialog instead of the OS share
  sheet. It previews the generated PNG and offers explicit PNG download, profile
  URL copy, and image-copy actions where the browser supports them.
- `/share` renders the same model as an HTML preview for link/manual sharing.

## Profile Rendering / Detail Enrichment (2026-10-30, Not Deployed)

- Profile acquisition remains coordinated by `profile-source.ts`, but tabs may
  independently omit the recent-roster or stored-history request. Empty tabs skip
  both; aggregation/report tabs keep the sources they actually consume.
- Match-list rows are converted to the v3 shape only for the requested page or
  Overview slice. `normalizeStoredMatches()` memoizes normalization per cached
  upstream payload array.
- Encounters no longer performs foreground bulk detail fills. It renders recent
  v3 rosters plus payload rows already in `MatchArchive`, queues uncovered IDs
  via `queueMatchDetails()`, and exposes partial coverage honestly.
- The shared `/api/cron/audit` runner now drains pending `MatchArchive` jobs even
  when no `AuditMatch` link exists; audit-linked rows retain priority ordering.
  Generic encounter jobs therefore reuse the same D1 quota, leases and retries.
- Route `loading.tsx` and section-level Suspense use tracker-shaped skeletons
  matching the real hero, tabs, filter rail, sidebar and content cards.

## Account Reports (2026-10-30 Review, Not Deployed)

- `account-report.ts` composes stored Competitive evidence and recent roster
  analysis. Both tabs explicitly use account-wide Competitive scope, not the
  hidden ACT/playlist query. The report carries its locale for consistent copy.
- Audit: >=40 valid stored rows; unavailable data cannot increase suspicion.
  Historical changes are descriptive indices, not ownership probabilities.
- Diagnosis: latest 25 Competitive rosters within 90 days, PUUID identity,
  >=10 valid rosters and >=5 decided games. Stats/rank/role use the same sample.
  `report-scope.ts` tops up a missing minimum with at most 10 recent detail IDs;
  audit performs no foreground historical fetch. Details now use the persistent
  archive and shared request budgets described above.
- `statsAvailable`/`accuracyAvailable` preserve missing stored fields. Diagnosis
  rejects incomplete/inconsistent teams, rounds, shot counts and ranks; draws
  are separate and zero-death games remain valid.
- `rank-benchmarks.ts` uses assumed constants. No empirical P95, calibrated
  probabilities, MLE, 90% CI or cheating verdicts are exposed. Unknown roles
  explicitly withhold scoring; role metadata is shared with `profile-stats.ts`.
- Report views share `report-ui.tsx` and scoped `report.css`: existing v3-card
  surfaces, tracker tokens, Saira headings, 300px rail and local table scrolling.
- Formula/review/verification record: `reports/20261030-account-report-review.md`.

## Review Corrections (2026-10-29, Not Deployed)

- Profile acquisition is coordinated by `profile-source.ts`: account first, then
  recent matches, stored matches, rating and rating history in parallel. Failures
  remain typed unavailable states; a history/rating 404 alone means no records.
- Account Audit reports retrieved-sample statistics, not guaranteed lifetime
  statistics. See the current Account Reports section for sampling and gates.
- `profile-filters.ts` supplies the same Act predicate to recent rosters and
  stored rows; Encounters preserves Act/Played Against query state.
- Watchlist admission uses one conditional INSERT/UPSERT with the distinct-player
  limit in its WHERE clause; no application read/check/write race or new schema.
  Subscriber reads have no implicit row cap before player deduplication.
- Unseen notifications are selected oldest-first, at most five per player/run.
  The cursor advances only through the selected delivered batch. Upstream recent
  history retention and overlapping-cycle delivery remain separate limitations.
- Language precedence: supported `lang` cookie, then supported Accept-Language
  preferences by quality, then English.

## 技術選定

| 領域 | 現在のプロトタイプ | 本番への方針・検証項目 |
| --- | --- | --- |
| Web | Next.js 16.4.3 App Router / React 19.3 / TypeScript 5 | 継続確定。`@opennextjs/cloudflare` 1.20.13 が Next 16.4 をサポート |
| CSS/UI | Tailwind CSS 4、lucide-react、抽出した配色 | **修正済み** — `next.config.ts` に `@tailwindcss/turbopack` loader rules を追加。ユーティリティ生成と hero 画像を検証済み |
| 言語 | `src/lib/i18n/` の en/ja 辞書と cookie | 初回は `Accept-Language`、手動選択は cookie を優先。翻訳漏れ/SSR 整合をテスト |
| 認証 | Better Auth 1.7 + Discord OAuth | サイト全体は `OWNER_DISCORD_IDS` + Discord account 紐付けで限定公開。`kt_` APIキーは `/api/valorant/*` で併用可 (`src/lib/owner-access.ts`, `src/lib/site-access.ts`) |
| ローカル DB | `next dev` で **ローカル D1 (Miniflare)**。`better-sqlite3` は CF コンテキスト無しのフォールバック | `src/lib/db.ts` の遅延バックエンドが D1/sqlite を自動選択 (生 SQL + Kysely) |
| 本番 DB | **Cloudflare D1 固定・PoC 済み** | `wrangler.jsonc` の `DB` バインディング。スキーマは `db/schema.sql` を `wrangler d1 execute` で適用 |
| ゲームデータ | HenrikDev API クライアント + Meiy シード | Map/Cache APIに加え、D1共有のキー別予算・クールダウン・試合詳細アーカイブを実装（未デプロイ）。watchは`fresh: true`。履歴補完は明示操作＋毎分Cron。共有枠設定にも対応 |
| 配信 | 未実装 | `tracking.kiwamero.dev`。Workers 対応アダプタ/ビルド/DNS/シークレットのデプロイ手順を確定 |
| 品質 | ESLint + `tsc` + `npm test` (node:test) | 型/単体/API 契約/認証/E2E/モバイルを CI で検証 |
| 監視通知 | **実装済み** — `src/lib/watch-core.ts` + `/api/cron/watch` + Worker scheduled | Workers Cron を毎時。D1 にシステム全体で最大100の監視対象、ユーザー別 Webhook、通知済み match ID を保持。送信失敗はカーソルを進めず次回再送 |
| UI検証 | プロフィール画面の参照画像あり | VALORANT 領域の全ページを棚卸し。まずデスクトップ同幅/同状態で比較、次にモバイルと操作を確認 |

## データフロー案

匿名ユーザー → `/login` または各ページの限定公開ゲート → Discord OAuth。

許可Discordユーザー → Better Auth セッション → `OWNER_DISCORD_IDS` 照合
→ Next.js 表示/検索 → サーバー側 HenrikDev クライアント → 正規化・
一時キャッシュ → プロフィール表示。同じ許可セッションのみ監視リストと
プロフィール向けAPIを利用できる。`/api/valorant/*` は有効な `kt_` APIキーも
受け付ける。所有者判定は Better Auth の Discord provider account ID と
サーバー側の `OWNER_DISCORD_IDS` 許可リストを照合する (実値はコミットしない)。

Workers Cron (毎時) → D1 から重複除去した監視対象を最大100件取得
→ HenrikDev から新規 match ID を確認 → ユーザー別の通知済み ID と照合
→ ユーザーごとの Discord Webhook に送信 → 結果を D1 に記録。
登録直後は直近1試合をそのユーザーへ通知する。
Webhook URL は機密情報として保管し、Discord の URL だけを許可する。
再実行時の重複排除と配信失敗時の再試行を設計し、レート制限の予算を超えない。
HenrikDev 資格情報、ユーザーセッション、開発者 API キーは別物。
プロフィール表示とwatchlist APIは許可Discordセッションのみ。開発者APIは
許可セッションまたは有効APIキー以外 403 とし、レート制限も適用する。

## 監視通知の実装 (2026-10-28)

- `src/lib/watch-core.ts` が純関数 (Webhook URL 検証、新着判定、Embed 生成) と
  DB 非依存の `runWatchCycle(db, deps)` を持つ。単体テストは `tests/`。
- `src/lib/watch-run.ts` が実際の HenrikDev / fetch を注入する。
- 発火経路は 2 つ: `POST /api/cron/watch` (`Authorization: Bearer CRON_SECRET`) と
  `src/worker.js` の `scheduled` (毎時 `0 * * * *`)。
- 登録直後は Webhook 保存時に同じサイクルを `{ userId, maxPlayers: 5 }` で実行し、
  直近1試合だけを送る (2回目以降は新着のみ、最大5件/回)。
- 重複排除は `WatchlistEntry.lastSeenGameStart` (Riot の `game_start`)。
  送信失敗した試合はその試合のカーソルを進めず、届いた試合までだけ進める。
- 通知は試合embed＋同じ `party_id` のメンバー別embedを順次送る。メンバーembedは
  agent icon、rank、match K/D/A、同 `season_id` の stored-match から集計した
  Season K/D を出し、未取得は `—` にする。
- 監視対象はシステム全体で 100 プレイヤー (`MAX_WATCHED_PLAYERS`)。同一プレイヤーを
  複数ユーザーが監視する場合も HenrikDev への照会は 1 回で済ませ、Season K/Dも
  run内 `puuid+season_id` でキャッシュする。

## Workers 実行時の制約 → 解消 (2026-10-29)

~~Prisma 7 は workerd で動かない~~ → **生 SQL + Kysely へ移行して解消** (ユーザー決定)。

移行内容:

- `src/lib/db.ts` — `getCloudflareContext` で D1 バインディングを遅延解決し、
  無ければ better-sqlite3 (`DATABASE_URL`, `db/dev.db`) へフォールバック。
  アプリは `queryAll/queryOne/execute` の生 SQL ヘルパーを使い、
  Better Auth は同じバックエンド上の Kysely インスタンス経由
  (`database: { db, type: "sqlite", transaction: false }`。
  D1 は interactive transaction を持たないため transaction:false)。
- テーブル名は既存スキーマの PascalCase を維持
  (`user/session/account/verification` の `modelName` で指定)。
- `src/lib/watch-db.ts` が `WatchDb` (Prisma 形の呼び出し面) を生 SQL で実装し、
  `watch-core.ts` と既存テストは無変更のまま。
- Prisma (`prisma`, `@prisma/*`, `src/generated/`, `prisma.config.ts`) は全除去。
  Worker バンドルは gzip 3.3 MB → **1.69 MB** に縮小し無料枠 3 MiB 内に収まった。
- 検証: `wrangler dev` + ローカル D1 で `POST /api/cron/watch` が完走
  (seed 監視エントリ → HenrikDev 実取得 → Webhook 404 で `webhookFailures:1`、
  カーソル未前進)。better-auth アダプタは `tests/db.test.ts` で
  createUser/createSession/findSession/createAccount を実スキーマに対して検証。

### 本番インシデント: getCloudflareContext async ハング (2026-10-29 修正済み)

症状: デプロイ直後、ルート不定期に ~42s ハング → クライアント側タイムアウト
(tail で `waitUntil() tasks did not complete` → outcome canceled)。

原因: `src/lib/db.ts` が `getCloudflareContext({async:true})` を使っていた。
async 版は `__cloudflare-context__` global が無い場合に wrangler の
`getPlatformProxy` を spawn しようとする。`nodejs_compat` では workerd 内でも
`NEXT_RUNTIME==="nodejs"` となりこの分岐に入り、workerd 内部で Miniflare
プロキシ起動が永久に解決しない。コールド isolate 上で global が未設定の
経路を踏むと発生し、`backendPromise` が pending のまま使い回されるため
その isolate への後続リクエストも連鎖ハングした。

修正: **同期版 `getCloudflareContext()` のみ使用** (global 無しなら即 throw
→ catch → sqlite フォールバック)。加えて:
- workerd 判定 (`navigator.userAgent === "Cloudflare-Workers"`) 時は
  better-sqlite3 の import 自体をスキップして即エラー
- `resolveBackend` に 8s タイムアウト + 失敗時 `backendPromise` リセット
  (一度の失敗で isolate を毒さない)

教訓: workerd 内で `getCloudflareContext({async:true})` はハング可能。
DB 接続のようなモジュールスコープの遅延 Promise は必ず失敗時リセットする。

### Windows 固有の注意 (2026-10-29 判明)

この環境では workerd/esbuild 等の子プロセスが `%TEMP%` 配下へ書けず、
`wrangler dev` / `wrangler d1 execute` / `build:worker` が
`CreateDirectory: Access denied` (miniflare-email-store) や esbuild の
書込み失敗で落ちる。**`TMP`/`TEMP` をプロジェクト内に向けて実行**すれば回避できる
(Node 本体は書けるため、原因は子プロセス向けの何らかのセキュリティ制御と思われる)。

## 本番移行時の決定ゲート

1. ~~Cloudflare Workers 上で Next.js 16 のページ描画~~ → PoC 済み。OAuth callback は本番のみ未検証。
2. ~~D1 の DB アダプタ・マイグレーション・ローカル/本番接続~~ → **解消 (2026-10-29)**:
   生 SQL + Kysely で workerd 上の D1 読み書きを確認済み。
3. ~~ORM 再選定~~ → ユーザー判断により **生 SQL + Kysely** に決定・実装済み。
4. HenrikDev の現行 API 契約と利用条件、RateLimit ヘッダーを確認する。
   無根拠な「30req/min」固定値で実装しない。

## 解消済みブロッカー (2026-10-27)

- ~~Tailwind utility 未生成 / hero 画像全画面~~ → `turbopack.rules` に
  `@tailwindcss/turbopack` を設定して解消。
- ~~任意 ID が Meiy データを受け取る~~ → `loadProfile` が `ProfileResult` を返し、
  404/401/403/429/その他を分類。シードは `Meiy#B3L` 完全一致のみ。
- ~~`players` 配列正規化~~ → live API も `{all_players, red, blue}` と実測判明。
  `hdMatchPlayers()` で両方対応。`team`/`has_won`/`rounds_won`/`damage_made`/
  `ability_casts` など実レスポンス形状に合わせて正規化。
- ~~`/api/keys`・匿名プロキシ~~ → `hasOwnerAccess`/`resolveOwnerAccess` で所有者
  (Discord ID 許可リスト連携のセッション、または `kt_` Bearer ハッシュ照合) のみ許可。
  匿名は 403。キーは `sha256:` ハッシュ保存・発行時のみ平文返却・DELETE で失効。
  **レート制限**: `src/lib/rate-limit.ts` の per-isolate 固定窓
  (既定 60 req/min、`API_RATE_LIMIT_PER_MIN`)。プラットフォーム側の
  Cloudflare rate limiting rule 併用を推奨 (docs/deployment-guide.md)。
- ~~`better-sqlite3` が Workers で動かない~~ / ~~Prisma 7 の Wasm 制約~~ →
  生 SQL + Kysely 移行で解消 (上記)。
- 2026-10-27 時点で `tsc --noEmit` / `lint` / `build` 全て成功、
  ブラウザ実検証も通過 (desktop/mobile/404)。

## 残る検証

- Discord OAuth の本疎通 (ログイン→セッション永続化→監視 CRUD) は未実施
  (Discord の画面で本人が認可する必要がある)。
- Workers 上での Cron 実行は **Prisma の Wasm 制約でブロック** (上記)。
  Node では `POST /api/cron/watch` で完走確認済み。
- 本番 D1 (`database_id` 発行、`--remote` 適用) とシークレット投入、デプロイは未実施。

## 2026-10-28 の検証結果

- `npx tsc --noEmit` / `npm run lint` / `npm test` (34 tests) / `npm run build` 成功。
- `npm run build:worker` (OpenNext) 成功 → `.open-next/worker.js` 生成。
- `wrangler deploy --dry-run` 成功: Prisma 時代は Worker 12.9 MB (gzip 3.3 MB)
  だったが、移行後は **gzip 約 1.69 MB** に縮小し無料枠 3 MiB 内に収まった。
  バインディング `DB` / `ASSETS` / `APP_URL`、`triggers.crons = ["0 * * * *"]`。
- `wrangler dev` でプロフィールページ 200 / cron ヘルス 200 / D1 経由の
  cron 完走を確認 (2026-10-29、生 SQL + Kysely 移行後)。
- ローカル D1 は `db/upgrade-2026-10-28.sql` で増分適用済み
  (webhookUrl / webhookUpdatedAt / region / lastSeenGameStart / lastNotifiedMatchId /
  lastNotifiedAt / index)。SQLite フォールバックは `tools/migrate-dev-db.mjs`。

## ローカル設定

- `kiwamero-tracking/.env`: ローカル専用、Git 対象外。キーが未設定なら
  HenrikDev ライブ取得と Discord ログインは検証できない。
- `kiwamero-tracking/.env.example`: 値を含まない変数一覧。
- Cloudflare 本番の秘密情報は `.env` をアップロードせず、環境バインディング/
  シークレットとして個別に設定する。
- Prisma 7 では接続 URL を `prisma.config.ts` へ移す方式。`DATABASE_URL` の
  パス解決と runtime/CLI の一致を次セッションで再検証する。

## 未解決の質問

- Workers + D1 で Next.js/Better Auth/ORM を動かす具体的な構成
  → **Prisma 7 は workerd 不可**。D1 ネイティブ / Drizzle への移行可否を判断する。
- HenrikDev のアクセス条件、公開データの範囲、費用上限。
- 監視・診断・共有 API の費用上限/呼び出し上限。
- 毎時100件の監視で HenrikDev のレート制限に収まるか (対象プレイヤー1リクエスト +
  パーティメンバーがいる試合だけ Season K/D 取得、run内キャッシュ + 250ms 間隔)。
