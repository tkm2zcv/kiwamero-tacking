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

## HenrikDev共有プール・履歴補完

- `HENRIK_API_KEYS`（カンマ区切り）と既存`HENRIK_API_KEY`を併用・重複排除。
  `.env.example`の`HENRIK_KEY_RPM=30`、`HENRIK_BACKGROUND_RPM=20`が既定です。
  D1で各呼び出しの枠を原子的に予約し、検索・監視用の枠を残します。
- 利用枠がアカウント単位なら`HENRIK_QUOTA_SCOPE=shared`。
  キー単位の独立枠は契約・レスポンスヘッダー等で確認してください。
  4本を持つだけで120回/分になるとは保証しません。
- 査定画面の「詳細補完を開始」で取得済みCompetitive履歴を登録します。
  変化点の前後を優先して毎分のCronで段階取得。ページ閲覧だけでは大量取得しません。
  完了した試合のロスター/統計はD1に永続保存し、別プレイヤーでも再利用します。
- 有効履歴・比較窓・期間別の保存済み/未補完/取得不能を表示。
  取得前・途中は暫定評価であり、未取得を「変化なし」とは扱いません。
- 既存DBは追加で`db/upgrade-2026-10-30.sql`を適用してください。
  `next dev`のローカルD1とフォールバックSQLiteは別DBです。
  `tools/migrate-dev-db.mjs`はSQLite側にもこの追加分を適用します。
- 既定の大量補完（最大100件/巡回）はWorkers PaidのCPU/D1クエリ枠を前提とします。
  最大20人同時、各5,000件・JSON1.8MB。上限超過は切り捨てず413を返します。

`next dev`だけではCronは自動起動しません。ローカルで登録済みキューを進める場合:

```bash
curl -X POST http://localhost:3002/api/cron/audit \
  -H "Authorization: Bearer $CRON_SECRET"
```

これは履歴補完だけです。`/api/cron/watch`は実際のDiscord通知を送る別処理です。
本番への適用は[追加の移行手順](../docs/deployment-guide.md)、
設計・制約は[キューのレビュー](../docs/reports/20261030-history-queue-review.md)を参照。

## 監視通知 (Discord Webhook)

1. Discord のチャンネル設定 → 連携サービス → ウェブフックで URL を発行。
2. `/watchlist` にログインし、URL を保存 (受け付けるのは `discord.com/api/webhooks/...` のみ)。
   保存直後に監視中プレイヤーの**直近1試合**を通知します。
3. 以降は毎時 Cron が新着試合だけを通知します (試合 ID と最終通知時刻で重複排除)。
4. システム全体で 100 プレイヤーまで (`src/lib/watch-core.ts` の `MAX_WATCHED_PLAYERS`)。

未通知が5試合を超える場合は、取得できた範囲の古い試合から5件ずつ通知し、
次のサイクルで残りを処理します。上流の直近試合レスポンスに含まれなくなった
試合の復元と、複数サイクルの同時実行に対する厳密な一度だけの配信は未対応です。
登録の100人上限は単一SQLで判定し、監視者数による読み取り打ち切りは行いません。

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

- Account Audit / Smurf Diagnosis はCompetitive固定の参考レポートです。
  査定は取得済み保存履歴40件以上、診断は直近90日・最大25試合のうち
  有効ロスター10件・決着5件以上が必要。不足時は採点しません。
  診断だけ標本不足時に最大10試合IDを補完（D1の試合詳細キャッシュを共用）。
  確率・実測P95・90%信頼区間・不正の断定は行いません。
  計算式と制約: [再検査レポート](../docs/reports/20261030-account-report-review.md)。
- Encounters は選択Act/モードで取得できたロスターの範囲を集計し、
  詳細取得の上限と部分カバレッジを表示します。全Act選択時の補完は最新2Actです。
- 初期言語は `Accept-Language` (日英・品質値順) から決定し、
  手動で選んだ `lang` cookie があればそちらを優先します。
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
