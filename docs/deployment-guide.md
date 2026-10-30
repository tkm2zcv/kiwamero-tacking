# Kiwamero Tracking: デプロイ手順

対象: `kiwamero-tracking/` → Cloudflare Workers + D1、`tracking.kiwamero.dev`。
DB 層は 2026-10-29 に Prisma から生 SQL + Kysely へ移行済み (workerd 動作確認済み)。

**状態: 初回デプロイ済み (2026-10-29)。** D1 `a8f05616-…` (APAC)、6シークレット投入、
`tracking.kiwamero.dev` カスタムドメイン、cron `0 * * * *` 全て稼働確認済み
(`/` 200、`/api/keys` anon 403、`/api/cron/watch` anon 401/認証 200、
プロフィール 200、POST cron `ok:true`)。
残る手動作業は Discord Developer Portal への本番 callback 登録のみ (§4)。
以降は再デプロイ・運用時の手順として参照すること。

## 2026-10-30 履歴補完版の追加移行（まだ本番未反映）

以下はデプロイ承認後の手順です。この作業では実行していません。

1. キーの独立枠と保存データの保持条件を確認する。
   独立枠未確認/共有枠なら`HENRIK_QUOTA_SCOPE=shared`。
   独立なら`key`。既定`HENRIK_KEY_RPM=30`、
   `HENRIK_BACKGROUND_RPM=20`は契約に応じて下げることもできる。
2. Workers PaidのCPU/D1クエリ枠・D1容量/費用を確認する。
   既定の最大100詳細/巡回は無料枠のクエリ数では保証しない。
3. **先に**追加スキーマを適用する（認証テーブルを作り直す必要はない）。

```bash
npx wrangler d1 execute kiwamero-tracking --remote --file=db/upgrade-2026-10-30.sql
```

4. 必要なキーを`HENRIK_API_KEYS` secretへ設定する（既存単一キーと併用可）。
   `CRON_SECRET`も必要。キーは画面/ログ/コミットに出さない。
5. 新版Workerをビルド・承認後にデプロイ。Cronは`* * * * *`になる。
   `src/worker.js`がUTC毎時0分だけwatchを実行してからauditを実行する。
   Cronを手動でwatchへ向けると実通知になるので注意。
6. 小さい履歴から査定の明示補完・進捗・429/再開を確認し、
   キュー、D1費用、CPU、通常検索/監視の余力を観測する。
   Cloudflare rate-limit/WAFで公開プロフィール/補完開始の濫用も制限する。

ローカル適用済みなのはD1/SQLiteのみ。本番の独立枠・実行費用・負荷・保持方針は
未検証です。[詳細レビュー](reports/20261030-history-queue-review.md)を参照。

## 前提

- Cloudflare アカウント: `npx wrangler login` 済みであること。
- `kiwamero.dev` ゾーンが Cloudflare DNS に登録済みであること (custom domain 用)。
- Windows では `TMP`/`TEMP` をプロジェクト内に向けて実行する
  (workerd が `%TEMP%` に書けない環境あり。例: `mkdir .tmp` した上で
  `set TMP=.tmp` / `set TEMP=.tmp`、bash なら `TMP=$PWD/.tmp TEMP=$PWD/.tmp`)。

## 1. D1 データベース作成

```bash
cd kiwamero-tracking
npx wrangler d1 create kiwamero-tracking
# → database_id が発行される。wrangler.jsonc の "database_id" プレースホルダを置換する。
```

`wrangler.jsonc`:

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "kiwamero-tracking", "database_id": "<発行されたID>" }]
```

## 2. スキーマ適用

```bash
npx wrangler d1 execute kiwamero-tracking --remote --file=db/schema.sql
```

スキーマの正本は `db/schema.sql` のみ。差分は `db/upgrade-*.sql` として追加する。

## 3. シークレット投入

```bash
npx wrangler secret put HENRIK_API_KEY
npx wrangler secret put DISCORD_CLIENT_ID
npx wrangler secret put DISCORD_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET     # 32文字以上の乱数。ローカルとは別値推奨
npx wrangler secret put CRON_SECRET          # POST /api/cron/watch 用
npx wrangler secret put OWNER_DISCORD_IDS    # カンマ区切りの Discord ID 許可リスト
# 任意: HenrikDev キーを複数持つ場合 (429 時にローテーション)
npx wrangler secret put HENRIK_API_KEYS      # カンマ区切り。HENRIK_API_KEY と併用可
```

変数 (秘密でないもの) は `wrangler.jsonc` の `vars` に追加する:

```jsonc
"vars": {
  "APP_URL": "https://tracking.kiwamero.dev",
  "BETTER_AUTH_URL": "https://tracking.kiwamero.dev"
}
```

`.env` / `.dev.vars` をアップロードしないこと。`BETTER_AUTH_SECRET` と
`DISCORD_CLIENT_SECRET` は本番用に新規生成してよい。

## 4. Discord OAuth のリダイレクト登録

Discord Developer Portal のアプリケーション設定に本番 callback を追加:

```
https://tracking.kiwamero.dev/api/auth/callback/discord
```

ローカル用 (`http://localhost:3002/api/auth/callback/discord`) は残してよい。

## 5. カスタムドメイン

`wrangler.jsonc` に追加 (ゾーンが Cloudflare にあれば証明書/DNS は自動):

```jsonc
"routes": [{ "pattern": "tracking.kiwamero.dev", "custom_domain": true }]
```

## 6. ビルドとデプロイ

```bash
npm run build:worker
npx wrangler deploy
```

- Worker サイズ: 移行後は gzip 約 1.7 MB (無料枠 3 MiB 内。Prisma 時代は超過していた)。
- Cron は `triggers.crons = ["0 * * * *"]` で自動登録される。初回から毎時実行されるので、
  CRON_SECRET を入れてからデプロイすること。

## 7. デプロイ後の確認

```bash
# ヘルス (認証済みのみ)
curl -H "Authorization: Bearer $CRON_SECRET" https://tracking.kiwamero.dev/api/cron/watch

# Cron 手動起動 (監視対象が登録済みなら実配信される)
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://tracking.kiwamero.dev/api/cron/watch

# 画面
https://tracking.kiwamero.dev/                          # 200
https://tracking.kiwamero.dev/valorant/profile/riot/Meiy%23B3L/overview
https://tracking.kiwamero.dev/login                     # Discord OAuth 開始
```

## 8. プラットフォーム側の推奨設定

- **レート制限ルール**: `/api/valorant/*` と `/api/keys` に Cloudflare の
  rate limiting rule を設定する。アプリ側の `src/lib/rate-limit.ts` は
  per-isolate のベストエフォート (既定 `API_RATE_LIMIT_PER_MIN`=60/min) であり、
  グローバルな強制にはプラットフォーム側が必要。
- **ログ**: `wrangler tail kiwamero-tracking` で Cron 実行 (`[cron]` プレフィックス)
  とエラーを監視できる。

## 未解決の質問

- gzip 1.7 MB は無料枠内だが、無料 Workers の CPU 時間制限 (10ms) に
  監視サイクルが収まるかは未検証。100人監視で HenrikDev 直列照会する設計のため、
  有料 (Workers Paid, 30s CPU) 前提が安全。
