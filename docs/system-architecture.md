# Kiwamero Tracking: 技術選定と構成 (draft)

対象は `kiwamero-tracking/`。これは「実装済み」と「本番推奨」を混同しないためのメモ。

## 技術選定

| 領域 | 現在のプロトタイプ | 本番への方針・検証項目 |
| --- | --- | --- |
| Web | Next.js 16.4.3 App Router / React 19.3 / TypeScript 5 | 継続確定。`@opennextjs/cloudflare` 1.20.13 が Next 16.4 をサポート |
| CSS/UI | Tailwind CSS 4、lucide-react、抽出した配色 | **修正済み** — `next.config.ts` に `@tailwindcss/turbopack` loader rules を追加。ユーティリティ生成と hero 画像を検証済み |
| 言語 | `src/lib/i18n/` の en/ja 辞書と cookie | 初回は `Accept-Language`、手動選択は cookie を優先。翻訳漏れ/SSR 整合をテスト |
| 認証 | Better Auth 1.7 + Discord OAuth | PoC で D1 経路確認。所有者専用 API は `OWNER_DISCORD_IDS` + Discord account 紐付けで実装済み (`src/lib/owner-access.ts`) |
| ローカル DB | `next dev` で **ローカル D1 (Miniflare)**。`better-sqlite3` は CF コンテキスト無しのフォールバック | `src/lib/prisma.ts` の遅延プロキシが D1/sqlite を自動選択 |
| 本番 DB | **Cloudflare D1 固定・PoC 済み** | `wrangler.jsonc` の `DB` バインディング。`@prisma/adapter-d1` 7.10.1。スキーマは `prisma/d1/schema.sql` を `wrangler d1 execute` で適用 |
| ゲームデータ | HenrikDev API クライアント + Meiy シード | 応答契約・可用性・レート制限を検証し、サーバー側キャッシュ/バックオフを実装 |
| 配信 | 未実装 | `tracking.kiwamero.dev`。Workers 対応アダプタ/ビルド/DNS/シークレットのデプロイ手順を確定 |
| 品質 | ESLint + `tsc` + `npm test` (node:test) | 型/単体/API 契約/認証/E2E/モバイルを CI で検証 |
| 監視通知 | **実装済み** — `src/lib/watch-core.ts` + `/api/cron/watch` + Worker scheduled | Workers Cron を毎時。D1 にシステム全体で最大100の監視対象、ユーザー別 Webhook、通知済み match ID を保持。送信失敗はカーソルを進めず次回再送 |
| UI検証 | プロフィール画面の参照画像あり | VALORANT 領域の全ページを棚卸し。まずデスクトップ同幅/同状態で比較、次にモバイルと操作を確認 |

## データフロー案

匿名ユーザー → Next.js 表示/検索 → サーバー側 HenrikDev クライアント
→ 正規化・一時キャッシュ → 公開プロフィール表示。

Discord ユーザー → Better Auth セッション → 自分の監視リスト → D1。
サイト所有者のみ開発者 API のキー管理へアクセスできる。
所有者判定は Better Auth の紐付いた Discord provider account ID と
サーバー側の `OWNER_DISCORD_IDS` 許可リストを照合する (実値はコミットしない)。

Workers Cron (毎時) → D1 から重複除去した監視対象を最大100件取得
→ HenrikDev から新規 match ID を確認 → ユーザー別の通知済み ID と照合
→ ユーザーごとの Discord Webhook に送信 → 結果を D1 に記録。
登録直後は直近1試合をそのユーザーへ通知する。
Webhook URL は機密情報として保管し、Discord の URL だけを許可する。
再実行時の重複排除と配信失敗時の再試行を設計し、レート制限の予算を超えない。
HenrikDev 資格情報、ユーザーセッション、開発者 API キーは別物。
公開プロフィール表示は匿名可。開発者 API は所有者以外 403 とし、レート制限も適用する。

## 監視通知の実装 (2026-10-28)

- `src/lib/watch-core.ts` が純関数 (Webhook URL 検証、新着判定、Embed 生成) と
  DB 非依存の `runWatchCycle(db, deps)` を持つ。単体テストは `tests/`。
- `src/lib/watch-run.ts` が実際の HenrikDev / fetch を注入する。
- 発火経路は 2 つ: `POST /api/cron/watch` (`Authorization: Bearer CRON_SECRET`) と
  `src/worker.js` の `scheduled` (毎時 `0 * * * *`)。
- 登録直後は Webhook 保存時に同じサイクルを `{ userId, maxPlayers: 5 }` で実行し、
  直近1試合だけを送る (2回目以降は新着のみ、最大5件/回)。
- 重複排除は `WatchlistEntry.lastSeenGameStart` (Riot の `game_start`)。
  送信に失敗した場合はカーソルを更新せず、次回に再送する。
- 監視対象はシステム全体で 100 プレイヤー (`MAX_WATCHED_PLAYERS`)。同一プレイヤーを
  複数ユーザーが監視する場合も HenrikDev への照会は 1 回で済ませる。

## Workers 実行時の制約 (2026-10-28 検証)

`opennextjs-cloudflare build` と `wrangler dev` で実際に起動して確認した結果:

- ページ描画 (HenrikDev のライブ取得、プロフィール全体) は **Worker 上で 200 応答**。
- `GET /api/cron/watch` (ヘルス) も 200。
- しかし DB を触る処理は workerd で失敗する:
  `CompileError: WebAssembly.Module(): Wasm code generation disallowed by embedder`。
  Prisma 7 のクエリコンパイラは実行時 Wasm コンパイルを行うため、
  workerd では原理的に動かない (Node では動作する)。
- 影響範囲: Better Auth のセッション参照、監視リスト、API キー、Cron の DB 更新。
  つまり **認証系と監視系は現状 Node 専用**。

### 決定ゲート (ユーザー判断が必要)

`docs/project-overview-pdr.md` の「本番移行時の決定ゲート 3」に該当。
Worker/D1 内で完結させるには、次のいずれかへの移行が必要:

1. **D1 ネイティブ + Drizzle ORM** へ置換 (Prisma を外す)。Better Auth も
   D1/Drizzle アダプタへ。影響: `src/lib/prisma.ts`、`auth.ts`、監視/キー API。
2. **Prisma を Node ランタイムで動かす** (Cloudflare Containers / 別ホスト)。
   PDR は Cloudflare Workers + D1 固定のため、構成変更の合意が必要。
3. Prisma Accelerate など外部データプロキシの導入 (追加コスト・秘密情報管理)。

現状は (1) が本命。移行までは Worker は「表示専用」、DB 機能は Node で動かす。

## 本番移行時の決定ゲート

1. Cloudflare Workers 上で Next.js 16 のページ描画・OAuth callback を PoC で通す。
2. D1 の DB アダプタ・マイグレーション・ローカル/本番接続を PoC で通す。
3. 1/2 の組み合わせに問題があれば Worker/D1 内で対応可能な
   ORM/認証アダプタを再選定する。別ホスト/別 DB への変更は勝手に行わずユーザーへ相談する。
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
- ~~`/api/keys`・匿名プロキシ~~ → `hasOwnerAccess` で所有者 (Discord ID 許可リスト
  連携のセッション、または `kt_` Bearer ハッシュ照合) のみ許可。匿名は 403。
  キーは `sha256:` ハッシュ保存・発行時のみ平文返却・DELETE で失効。
- ~~`better-sqlite3` が Workers で動かない~~ → `@prisma/adapter-d1` へ
  OpenNext の `getCloudflareContext` 経由で切替済み。
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
- `wrangler deploy --dry-run` 成功: Worker 12.9 MB (gzip 3.3 MB)、
  バインディング `DB` / `ASSETS` / `APP_URL`、`triggers.crons = ["0 * * * *"]`。
  gzip 3.3 MB は無料枠 (3 MiB) をわずかに超えるため、デプロイは有料枠か
  バンドル削減 (Prisma を外す) が前提。
- `wrangler dev` でプロフィールページ 200 / cron ヘルス 200 を確認。
  DB クエリは workerd の Wasm 制約で失敗 (上記)。
- ローカル D1 は `prisma/d1/upgrade-2026-10-28.sql` で増分適用済み
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
- 毎時100件の監視で HenrikDev のレート制限に収まるか (現在は 1 プレイヤー 1 リクエスト +
  250ms 間隔で直列処理)。
