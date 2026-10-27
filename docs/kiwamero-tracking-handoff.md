# 次セッション引き継ぎ: Kiwamero Tracking

新規アプリ: `kiwamero-tracking/` (親の旧アプリは別物)。
**本格実装は次セッション**。先に
`docs/project-overview-pdr.md`、`docs/system-architecture.md`、
`plans/261027-1834-kiwamero-tracking/plan.md` を読む。
Next.js 16 のコード変更前には `kiwamero-tracking/node_modules/next/dist/docs/` の
該当ガイドを確認すること (`AGENTS.md`)。

## 決まったこと

- 名称: Kiwamero Tracking。tracker.gg の VALORANT 領域全体の
  レイアウト/配色を強く参照しつつ独自ブランド。
- UI 比較はデスクトップを先に仕上げ、その後モバイルを確認。
  ホーム・検索・ランキングなど既存試作にないページも棚卸しして追加する。
- VALORANT 以外のゲームは対象外。有料/ログイン限定の機能は利用可能なデータから
  独自に同等体験を実装する。アクセス制限を回避したり元サイトの非公開データを使わない。
- 初回は PC のプロフィール検索と高度な統計・比較を優先する。
  Console と LFG/OBS/クロスヘア/ラインナップは後続候補。
- 誰でも閲覧できるプレイヤー検索。日英切り替え。
- Discord OAuth は監視リストに使用。開発者 API は環境変数で指定した
  Discord ID 許可リストの所有者だけが利用できる。
- 監視・既存サイトで観測可能な診断項目から参考スコアと根拠を表示する査定・共有カード・
  所有者専用の開発者 API まで初回に含める。
- 共有カードは初回 URL 共有のみ (PNG の生成/ダウンロードは後回し)。
- 公開先: **Cloudflare Workers + D1 固定**、`tracking.kiwamero.dev`。
- ローカル SQLite + Prisma 7 は試作済み。本番接続は D1 向けに変更する。
- 取得可能な公開プロフィールを誰でも閲覧できるようにする。
  非公開・未収録・API 制限は区別し、取得不可と表示する。
- 初期言語はブラウザ設定。手動変更は cookie で維持する。
- 監視対象は毎時確認し、ユーザーごとの Discord Webhook に新しい試合を通知。
  全体で100プレイヤー上限。登録直後は直近1試合を通知する。
  URL の保存/登録 UI と送信の重複防止は未実装。
- 戦績カード共有 URL はアクセス時点の最新統計を表示する。

## ローカル設定

- `kiwamero-tracking/.env` は作成済み・Git 管理外。`HENRIK_API_KEY`,
  `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `OWNER_DISCORD_IDS`,
  `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` はすべて設定済み
  (値は非表示で確認のみ)。
- 見本は `kiwamero-tracking/.env.example`。Git は `.env` と `prisma/*.db` を除外する。
- HenrikDev キー: `https://api.henrikdev.xyz/dashboard/api-keys` で発行。
  Discord OAuth redirect: `http://localhost:3002/api/auth/callback/discord`。
- 本番のシークレットは Cloudflare のシークレット/バインディングで別に設定する。

## 検証済みステータス (2026-10-27)

- **Tailwind/Turbopack**: `next.config.ts` に `rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } }` を追加して解消。ユーティリティ生成・ヒーロー画像の `fill` も正常。desktop 1440px / mobile 390px で確認。
- **ライブデータ**: HenrikDev 実キーで Meiy プロフィール取得成功。勝率 80% (8W/1L)、実スコア、チームメイト/Top Agents すべて実データ。
- **API 形状の実測** (`/valorant/v3/by-puuid/matches`): `players` は `{all_players, red, blue}` オブジェクト、プレイヤーのチームは `team: "Red"` (`team_id` ではない)、`teams.*.has_won`/`rounds_won`、ダメージは `damage_made`/`damage_received` トップレベル、`ability_casts` は `{c_cast,...}`、`metadata.map` は文字列。全て `src/lib/data.ts` で正規化済み。DM/hurm 等 FFA は `team`/`rounds_played` 無しを許容。
- **誤データ除去**: `loadProfile` は成否つき `ProfileResult` を返す。404→not_found、401/403→private、429→rate_limited、その他→upstream。シードは `Meiy#B3L` 完全一致のみ。任意IDには「Profile unavailable」ページを表示 (検証済み)。
- **認証・API セキュリティ**: `/api/keys` と `/api/valorant/*` プロキシは `hasOwnerAccess`/`ownerUserId` で所有者専用化 (匿名=403)。APIキーは `sha256:` ハッシュ保存・発行時のみ平文表示・DELETE で失効可。Bearer `kt_<64hex>` をハッシュ照合する経路を実測 (200)。
- **Workers + D1 PoC 完了**: `@opennextjs/cloudflare@1.20.13` (Next 16.4対応)、`@prisma/adapter-d1@7.10.1`、wrangler 4.153。`wrangler.jsonc` の `DB` バインディング + `initOpenNextCloudflareForDev()` で `next dev` 内から Miniflare D1 を解決。`src/lib/prisma.ts` は遅延プロキシで D1/better-sqlite3 を自動切替。`prisma migrate diff` → `prisma/d1/schema.sql` → `wrangler d1 execute --local` で6テーブル作成済み。`[prisma] using D1 adapter` ログで実測確認。
- **検証**: `npx tsc --noEmit` 0、`npm run lint` 0、`npm run build` 成功 (全ルート ƒ)。

## 残ブロッカー

1. **Discord OAuth 本疎通**: `.env` は設定済みだが、ブラウザでのログイン→セッション書込み→監視リストCRUDの実流しは未検証 (D1 への書込み経路含む)。
2. **監視基盤**: Workers Cron 未実装。毎時チェック・新規試合の重複排除・ユーザー別 Webhook 送信は未実装。
3. **Win 率等の色付け/一部UI差分**: 本番 tracker.gg との細部差分 (パーセンタイル、モード名 `hurm` のラベル等) は未対応。
4. **テスト未整備**: 正規化・エラー分岐の自動テストを追加する余地あり (現在は手動 curl + スクショ検証)。
5. **デプロイ未実施**: 本番 D1 の `database_id` 発行、`wrangler secret` 投入、`opennextjs-cloudflare build/preview/deploy`、`tracking.kiwamero.dev` ルーティングはこれから。本番前に `d1-schema.sql` の再生成と `wrangler d1 migrations` 運用を決める。
6. **README**: 古い create-next-app 文面が残っている。更新済みか再確認。

## PSTACK の利用方法

調査元: `https://github.com/cursor/plugins/tree/main/pstack` の README、
`skills/setup-pstack/SKILL.md`、`skills/poteto-mode/SKILL.md`、
`skills/poteto-mode/playbooks/visual-parity.md`。

- PSTACK は Cursor のプラグイン。**この Devin Desktop/CLI には未導入で、
  `/poteto-mode` をネイティブ実行できない**。CLI に移るだけでも変わらない。
- Cursor での導入は `/add-plugin pstack`。続けて `/setup-pstack`、
  `/poteto-mode <次のタスク>`。導入/権限設定は次セッションで確認してから行う。
- Orca を使う場合は、Orca の作業環境で Claude Code を起動し、
  Claude Code に `/plugin marketplace add cursor/plugins`、
  `/plugin install pstack@cursor-plugins` で追加できる。
  主コマンドは `/pstack:setup-pstack` と `/pstack:poteto-mode`。
  Orca 自体に PSTACK が内蔵されているわけではない。
- Devin 続行なら PSTACK の手法を参考にするが、プラグインそのものの
  実行とは呼ばない。Devin の `run_subagent` で独立した調査/実装を並列化する。
- PSTACK は PR/マージ/ワークツリー操作に進める手順もある。自動の push、
  マージ、デプロイ、削除は許可せず、手順をレビューしてから有効化する。
- 今回は**読み取り専用の並列調査**のみ実施。PSTACK のインストール、
  実行、デプロイ、PR 作成はしていない。

## 次セッションの並列化 (ファイル担当を分ける)

- UI担当: Tailwind 導入設定、デザイン照合、レスポンシブ、表示系コンポーネント。
- データ担当: HenrikDev レスポンス契約、正規化、取得不能時の状態とテスト。
- 認証/基盤担当: Cloudflare Workers + D1 PoC、DB/Better Auth 構成とキー安全性。
- 統合担当: 3系統の変更が衝突しないようレビューし、API 表示・認証・
  build/lint/E2E を最後に通す。並列作業はファイル範囲を明示して分担する。
- PSTACK 対応ホストなら最初に session pickup / multi-phase plan を選び、
  UI の visual parity と API/auth の feature/bug fix を独立作業に切り分ける。
  オーケストレータは 1 人、各担当は別ファイル/別作業環境で作業する。

## 未解決の質問

- 所有者 Discord ID の実値をローカル `.env` と Workers シークレットに設定。
- スマーフ参考スコアの入力/計算式/誤判定の表現。
- 共有カード URL の表示指標と有効期限。
- ユーザー別 Webhook URL の安全な保管/検証/更新/削除の方法。
- HenrikDev の実際の利用条件・予算で100プレイヤーを毎時監視できるか。
- 有料/ログイン限定の機能で優先すべきものと、データが無い場合の代替表現。
- 高度統計のパーセンタイル母集団をどこから合法的に得るか。
- PSTACK は Devin Desktop 上では手法として採用。プラグイン本体の導入は保留。
