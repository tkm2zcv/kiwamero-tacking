# Kiwamero Tracking: デプロイ手順

対象: `kiwamero-tracking/` → Cloudflare Workers + D1、`tracking.kiwamero.dev`。
DB 層は 2026-10-29 に Prisma から生 SQL + Kysely へ移行済み (workerd 動作確認済み)。

**状態: 本番反映済み (261114更新)。** code `aeb62cf`、Worker
`fa1e4ded-9ea4-4a03-9ec7-90ee6a0b3c88`、D1 `a8f05616-…` (APAC)、
`tracking.kiwamero.dev`、必要なシークレットとDiscord callbackは設定済み。
Cronは `* * * * *` で、watchはUTC毎時0分、auditは毎分です。
承認された監視1回で5件のDiscord送信成功と通知済み記録を確認しています。
画像生成の追加修正後、新着1件の画像送信と保存も確認済みです。ただし同巡回で
2人分の取得元HTTP502が残り、全対象の取得正常化まで確認したわけではありません。
`npm run deploy` は外部送信しない実workerd回帰 → build → scrub → deploy の順です。
画像回帰は実PNG生成・添付と静的WASM同梱を検証します。Satoriの固定版を
変更する際もこの検証が必要です。
`redirect:"error"` はWorkers未対応のため、Webhook送信には使用しません。
詳細な検証範囲・制約は [引き継ぎ](kiwamero-tracking-handoff.md) を参照してください。

最新の反映は `aeb62cf` (機能本体は `101ad48`)。試合履歴のプレイリストを
Competitive/Premier/Unrated/Deathmatch/Swiftplay＋Allに加え、
Team Deathmatch・Custom・Gauntlet・Spike Rush・Escalation・Replication・
Snowballを `⋮` メニューから選択可能にしました。HenrikDevのmode_id
(`hurm`/`skirmish_2v2`/`abilitydraftarena`)と保存済み表示名を
canonical slugへ正規化して照合します。上流取得は従来5モードのみ絞り、
それ以外は全モード取得→クライアント側フィルタです。
あわせて `aeb62cf` でスクロールバーを標準プロパティ＋WebKitフォールバック化。
この間の未記録分として `af8aa2e` (Party Size Breakdown) と
`e58a0a5` (遭遇ロスター全履歴バックフィル) も本番反映済みです。
353テスト・lint/型検査・実workerd/D1検証・build/scrubを通過。
2026-11-14にWorker100%反映、配信BUILD_ID `IBrGTiz2zP8439o6A-Dae`一致、
トップ/ログイン200・未認証API403を確認。ログイン後の実画面は未確認。
DB移行・手動の試合取得・Discord送信は実行せず。

以下は直前の `5ba21cd` の反映記録です。
ユーザー要望により、通常の外部ドキュメント遷移は
クリック情報がなくても確認画面を挟まず直接プロフィールを表示します。
Discordの許可確認は先に実施し、API・埋め込み・先読みの保護は維持。
外部中継から通常のプロフィール取得/キャッシュ更新が始まることは意図した変更です。
343テスト・lint/型検査・実D1/PNG・build/scrub・画面/中継ブラウザ検証を再通過。
2026-11-04T05:55:54.203552ZにWorker100%反映。
BUILD_ID `vp38PuP0EOyX3C4b5H2mD`一致、05:56UTCにトップ/ログイン200、
未認証API403、中継/クリック/埋め込み相当の匿名プロフィール認証制限を確認。
古い確認文言も配信HTMLから除去済み。実ユーザーの認証済みGoogle経路は未確認。
DB移行や手動のDB/auth/許可リスト変更・試合取得・Cron/Discord送信は実行せず。

以下は直前の `c31762f` の反映記録です（確認画面は最新版で撤去済み）。
クリック情報が失われた中継は、閲覧権限の確認後「プロフィールを開く」で続行できます。
確認前は戦績取得や背景取得を開始せず、プロフィール・タブ・フィルターを保持します。
ナビゲーション失敗を誤って未登録アカウントと表示しません。API・埋め込みの保護は維持。
以前の国旗/ランクアイコン、査定配点、遭遇ALL/直近50・プロフィール永続化は維持。
343テスト・lint・型検査・実workerd/D1・PNG検証、Next/Workerビルド・scrub、
JA/EN査定レイアウトと確認画面の幅1440/1024/375px検証を通過。
実ブラウザの直接リンク/302/HTML中継/JS中継、全ページ予算/キャッシュ回帰も通過。
2026-11-04 05:28:58 UTCに反映し、05:29 UTCに確認。
トップ/ログイン200、配信BUILD_ID `39GOGC1r4D2eNArou8sZr`一致、
本番version100%、未認証API403・匿名の中継/クリック/埋め込み相当の
プロフィールAccessGateを確認済み。実ユーザーの認証情報は使用していません。
実際のスプレッドシート経路・ログイン後の本番確認画面は未確認です。
ローカルの中継再現成功と、ユーザーの実症状解消は区別してください。
今回の追加DB移行は不要。下記移行2本は以前に適用済みで、再実行していません。
手動Cron・Discord送信・実ユーザー大量取得は未実行。
ログイン後の実プロフィール目視、実アカウント差分取得の本番検証は未実施です。

## 2026-11-04 遭遇ALL・直近50試合版の追加移行（本番適用済み）

プロフィール永続化も含め、下記をWorker更新前に本番適用済み：

```bash
npx wrangler d1 execute kiwamero-tracking --remote --file=db/upgrade-2026-11-04-profiles.sql
```

- `ProfileSnapshot`を追加するだけで既存データを削除しません。本番適用済みです。
- ローカルD1は`--local`、SQLiteは`node tools/migrate-dev-db.mjs`で適用できます。
- メモリ/edgeキャッシュを失ってもプロフィールが元の取得時刻で復元されること、
  更新時の本人履歴が最新50件チェックからマージされることを確認します。
- 上流障害では以前の保存データを残し、権限喪失・不存在はスナップショットを無効化。
- 本番/実APIを呼ばない`npm run check:profile-worker`で圧縮BLOBと失効フェンスを検証。

この版は`RosterHistory`と`RosterHistoryMatch`を追加します。既存の認証・監視・
保存済み試合は変更しません。承認後、Worker更新より先に本番適用しました。

```bash
npx wrangler d1 execute kiwamero-tracking --remote --file=db/upgrade-2026-11-04.sql
```

- `IF NOT EXISTS`で再実行可能です。既存テーブルの削除・作り直しは不要です。
- ローカルD1は同じSQLを`--local`、SQLiteは`node tools/migrate-dev-db.mjs`で適用。
- Cronは既存の毎分ルートを使用。手動CronやDiscordテストの実行は不要です。
- 遭遇タブで新規登録するのは全カテゴリー通算の直近50試合だけです。
  既定10リクエスト/巡回は全体の処理予算であり、1人の取得範囲ではありません。
  全50件未保存・欠落なしなら5回。保存済み分と新しい1試合だけの差分を確認します。
- `ALL`は全試合カテゴリー、All Actsは全期間の保存済み分。古いActを開いても
  過去全件の取得は開始しません。画面には直近対象と過去の未保存分を分けて表示。
- このSQLには`targetsJson`/`observedAt`も同じ追加SQLへ含めています。
  以前の未確定SQLを手動適用した開発DBには、この2列の追加が別途必要です。
- 反映確認は取得済み/対象/取得不能の件数と、2回目表示で既存分を再取得しないこと。
  実アカウントの大量取得は別途承認された範囲で行ってください。
- 401/403または5回の非429失敗で対象のページ取得を停止します。設定・障害を
  解消した後の再開は管理者による対象キューの確認が必要です。429は自動再開します。

## 2026-10-30 履歴補完版の追加移行（本番適用済み）

既存本番へは2026-10-31に適用済みです。以下は未移行環境のための手順であり、
通常の再デプロイで再適用するものではありません。

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

本番スキーマは適用済みですが、独立枠・実行費用・最大負荷・保持方針を保証する
検証ではありません。[詳細レビュー](reports/20261030-history-queue-review.md)を参照。

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

- `next.config.ts` は `experimental.cpus: 4` で静的生成ワーカーを制限する。
  Windowsの低メモリ環境で `next build` が仮想メモリ不足で落ちる事例への対策。
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
