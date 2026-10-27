# Project Changelog

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
