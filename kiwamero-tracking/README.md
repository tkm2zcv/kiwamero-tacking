# Kiwamero Tracking

tracker.gg 風の VALORANT トラッカー。公開プロフィールはログイン不要で閲覧でき、
Discord OAuth は監視リスト・所有者専用開発者 API に使います。
親ディレクトリの `kiwamero-tracker` は別の旧アプリです。

作業開始前に [要件定義](../docs/project-overview-pdr.md)、
[技術選定](../docs/system-architecture.md)、
[次セッション引き継ぎ](../docs/kiwamero-tracking-handoff.md) を確認してください。

## スタック

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/turbopack` ローダー、`next.config.ts` で設定済み)
- HenrikDev API (非公式 VALORANT データ)
- Better Auth + Discord OAuth (監視リスト用、所有者判定は `OWNER_DISCORD_IDS`、
  Kysely アダプタ経由)
- DB: 生 SQL — Cloudflare: D1 バインディング / ローカル・テスト: better-sqlite3
  (`src/lib/db.ts` が実行コンテキストで自動切替。Prisma は workerd 非対応のため除去済み)
- 本番構成: Cloudflare Workers + D1 (OpenNext、`@opennextjs/cloudflare` 1.20.x)
- 監視通知: Workers Cron (毎時) → ユーザーごとの Discord Webhook

## ローカル起動

```bash
npm install
npm run dev -- -p 3002
```

`.env` は Git 管理外。必要な環境変数は `.env.example` を参照。
`HENRIK_API_KEY` / Discord OAuth / `OWNER_DISCORD_IDS` は設定済みなら
実データ連携が有効になり、未設定・失敗時でも `Meiy#B3L` のシードのみ表示します。

## スクリプト

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | Next.js 本番ビルド |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `node --test` による単体テスト (Node 24 の型ストリップを使用) |
| `npm run check` | lint + typecheck + test + build |
| `npm run build:worker` | OpenNext で Workers バンドルを生成 (`.open-next/`) |
| `npm run preview:worker` | 生成した Worker を wrangler dev で起動 |

## DB (ローカル D1 / SQLite)

- `next dev` は `initOpenNextCloudflareForDev` 経由で Miniflare の **ローカル D1**
  (`wrangler.jsonc` の `DB` バインディング) を使います。
- 新規 DB: `npx wrangler d1 execute kiwamero-tracking --local --file=db/schema.sql`
- 既存 DB (2026-10-27 版から更新): `npx wrangler d1 execute kiwamero-tracking --local --file=db/upgrade-2026-10-28.sql`
- スキーマの唯一の正本は `db/schema.sql` (手管理。変更時は差分 SQL を同フォルダに追加)。
- フォールバックの better-sqlite3 (`DATABASE_URL`, `db/dev.db`) は
  `node tools/migrate-dev-db.mjs` で同じ差分を適用できます。
- Windows では workerd/esbuild が `%TEMP%` へ書けない環境があり、`TMP`/`TEMP` を
  プロジェクト内 (例: `.tmp`) に向けて `wrangler dev` / `wrangler d1` を実行すると回避できます。

## 監視通知 (Discord Webhook)

1. Discord のチャンネル設定 → 連携サービス → ウェブフックで URL を発行。
2. `/watchlist` にログインし、URL を保存 (受け付けるのは `discord.com/api/webhooks/...` のみ)。
   保存直後に監視中プレイヤーの**直近1試合**を通知します。
3. 以降は毎時 Cron が新着試合だけを通知します (試合 ID と最終通知時刻で重複排除)。
4. システム全体で 100 プレイヤーまで (`src/lib/watch-core.ts` の `MAX_WATCHED_PLAYERS`)。

手動実行:

```bash
curl -X POST http://localhost:3002/api/cron/watch \
  -H "Authorization: Bearer $CRON_SECRET"
```

`CRON_SECRET` 未設定の `next dev` では認証なしで実行できます (開発時のみ)。

## 検証

```bash
npm run check        # lint + typecheck + test + build
npm run build:worker # OpenNext (Workers) バンドル
```

現状の既知の制約:

- ~~Prisma 7 は workerd 上で動作しません~~ → **解消 (2026-10-29)**。
  DB 層を生 SQL + Kysely に移行し、認証・監視・Cron が Worker 上で動作確認済み
  (ローカル D1 で Cron 完走、better-auth アダプタはテストで検証)。
- 開発者 API (`/api/valorant/*`, `/api/keys`) のレート制限は
  `src/lib/rate-limit.ts` の per-isolate 固定窓 (既定 60 req/min、
  `API_RATE_LIMIT_PER_MIN` で変更可)。確実な実施には Cloudflare の
  レート制限ルールを併用してください。
- OpenNext のビルドは Windows でシンボリックリンク作成に失敗するため、
  `npm run build:worker` は `tools/fs-symlink-fallback.cjs` を preload して
  コピーにフォールバックします (WSL/CI では不要)。
- Windows で `wrangler dev` / `wrangler d1` が `miniflare-email-store` の
  `CreateDirectory: Access denied` で落ちる場合は `%TEMP%` 書込みブロックが原因。
  `TMP`/`TEMP` をプロジェクト内ディレクトリに向けて実行してください。

デプロイ手順は [docs/deployment-guide.md](../docs/deployment-guide.md)。
