# Kiwamero Tracking

tracker.gg 風の VALORANT トラッカー。公開プロフィールはログイン不要で閲覧でき、
Discord OAuth は監視リスト・所有者専用開発者APIに使います。
親ディレクトリの `kiwamero-tracker` は別の旧アプリです。

作業開始前に [要件定義](../docs/project-overview-pdr.md)、
[技術選定](../docs/system-architecture.md)、
[次セッション引き継ぎ](../docs/kiwamero-tracking-handoff.md) を確認してください。

## スタック

- Next.js 16 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS v4 (`@tailwindcss/turbopack` ローダー、`next.config.ts` で設定済み)
- HenrikDev API (非公式 VALORANT データ)
- Better Auth + Discord OAuth (監視リスト用)
- Prisma 7 — ローカル: better-sqlite3 / Workers: **D1** (`@prisma/adapter-d1`)
- 本番構成: Cloudflare Workers + D1 (OpenNext、`@opennextjs/cloudflare` 1.20.x)

## ローカル起動

```bash
npm install
npm run dev -- -p 3002
```

`.env` は Git 管理外。必要な環境変数は `.env.example` を参照。
`HENRIK_API_KEY` / Discord OAuth / `OWNER_DISCORD_IDS` は設定済みなら
実データ連携が有効になり、未設定・失敗時でも `Meiy#B3L` のシードのみ表示します。

## DB (ローカル D1 / SQLite)

- `next dev` は `initOpenNextCloudflareForDev` 経由で Miniflare の **ローカルD1**
  (`wrangler.jsonc` の `DB` バインディング) を使います。
- スキーマ適用: `npx wrangler d1 execute kiwamero-tracking --local --file=prisma/d1/schema.sql`
- スキーマ再生成: `npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script -o prisma/d1/schema.sql`
- better-sqlite3 (`DATABASE_URL`, `prisma/dev.db`) は Cloudflare コンテキストが
  無い場合のフォールバックです。

## 検証

```bash
npx tsc --noEmit
npm run lint
npm run build
```

2026-10-27 時点で全て成功。`/valorant/profile/riot/Meiy%23B3L/overview` で
HenrikDev のライブデータ描画、存在しない Riot ID で「Profile unavailable」を
実ブラウザ/スクショ確認済み。
