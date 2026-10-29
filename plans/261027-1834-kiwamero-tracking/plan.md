# Kiwamero Tracking — 実装計画 (2026-10-27)

**先に読む**: `docs/project-overview-pdr.md` (要件)、`docs/system-architecture.md` (技術選定とブロッカー)。
現状は試作途中。ビルド成功履歴はあるがブラウザ表示は未完了。次セッションで修正・検証する。

## Goal
tracker.ggのUIに極力近い独自ブランドを作り、取得可能な公開プロフィールをログイン不要で閲覧（vtl式）、valosmurf/KiwameroTracker独自機能を統合する。

## Decisions (user)
| 項目 | 決定 |
|---|---|
| 配置 | `kiwamero-tracker/kiwamero-tracking/` (新規) |
| サイト名 | Kiwamero Tracking |
| UI | tracker.gg の VALORANT 領域だけを高精度で参照。デスクトップ優先、後からモバイル検証。独自名/ロゴ |
| 言語 | 初回はブラウザ設定、手動の日英切り替えは cookie で維持 |
| 公開性 | 取得可能な公開プロフィールは認証不要。非公開・未収録は取得不可を明示 |
| 認証 | Discord OAuth (監視対象に使用、開発者 API は所有者だけ) |
| DB | ローカル SQLite + Prisma 7 は試作。本番 Cloudflare D1 に固定、互換構成は未検証 |
| データ | HenrikDev API (api.henrikdev.xyz) リアルタイム + `.env` HENRIK_API_KEY。シードは開発/テスト専用 |
| 独自機能 | 診断の参考スコア+根拠 / 全体100プレイヤーを毎時監視しユーザー別 Discord Webhook 通知 (初回直近1試合) / 最新戦績のURL共有 / Discord ID許可リストの所有者専用API |
| 限定機能 | tracker.gg の有料/ログイン限定機能も、利用可能なデータと独自実装で同等体験を検討。アクセス制限の回避はしない |
| 優先度 | 初回は VALORANT PC。限定機能は高度な統計/比較を先行。Console、LFG、OBS、クロスヘア/ラインナップは後続候補 |
| 公開先 | Cloudflare Workers + D1、`tracking.kiwamero.dev` (デプロイ未実施) |

## Architecture
- Next.js 16 + TS + Tailwind v4 (新規 scaffold, cacheComponents対応済み手順踏襲)
- tracker.gg tokens: `docs/research/tracker-gg-tokens.json` (482 vars) を globals.css に反映
- `src/lib/henrikdev.ts` — APIクライアント (server-only)。レート制限対応は未実装
- `src/lib/i18n/` — 軽量辞書プロバイダ (en/ja, cookie)
- `src/lib/auth.ts` + better-auth (Discord provider, Prisma adapter, ローカルSQLite/本番D1)
- `prisma/schema.prisma` — User / WatchlistEntry
- Seed fallback: 既存 `src/data/*.json` (Meiy) は開発用のみ。他人のIDで流用しないよう修正が必要

## Routes (tracker.gg準拠 + 独自)
- `/` — home search (tracker.gg hero search style)
- `/valorant/profile/riot/{name%23tag}/{tab}` — 現在のルート (概要・試合・分析・エージェント・マップ・診断・共有)
- `/watchlist` — 監視対象 (要ログイン)
- `/.../{name%23tag}/diagnosis` — スマーフ診断+査定 (試作中)
- `/.../{name%23tag}/share` — 戦績カード (画像生成/OGP は未実装)
- `/developers` — ドキュメント公開、APIキー発行/失効は所有者専用
- `/api/valorant/*` — データ取得経路。所有者用 API と公開ページを分離し、レート制限
- `/api/auth/*` — better-auth

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | Scaffold + tracker.gg tokens/fonts + nav shell | done (2026-10-27 実測リビルド) |
| 2 | i18n辞書基盤 (en/ja) | prototype (プロフィール画面は parity 優先で英語固定) |
| 3 | HenrikDev APIクライアント + 保護された取得経路 | done (所有者専用 API + 正規化 + テスト) |
| 4 | プロフィール・試合一覧 | done (実測準拠 UI) |
| 5 | performance/agents/maps タブ | prototype (SeasonsTable は旧スタイル) |
| 6 | Discord OAuth + D1 + 監視対象 | prototype (OAuth 実ログイン未検証) |
| 6b | Workers Cron + 新規試合差分検出 + ユーザー別 Discord Webhook | **done (Node 検証済み)** / Workers 実行は Prisma 制約待ち |
| 7 | スマーフ診断+査定ページ | prototype (参考スコアカードを独自実装) |
| 8 | 戦績カードURL共有 + /developers | prototype (画像生成は対象外) |
| 9 | Workers/D1 PoC・build/lint/ブラウザ検証・Cloudflare配信 | build/dry-run/dev まで完了。本番デプロイと Prisma 移行が残 |
| 10 | tracker.gg VALORANT 全ページ棚卸しと不足ルートの追加 | partial (プロフィールのみ実測再現。ランキング等は未着手) |
| 11 | 高度統計・ランク推移・プレイヤー比較のデータ可能性と指標定義 | partial (Score/Roles/Maps/Accuracy を独自指標で実装、パーセンタイルは未対応) |

## 2026-10-28 の更新

- 監視通知 (Phase 6b) を実装し、Node 上で完走確認。テスト 34 件を追加。
- OpenNext ビルド + `wrangler deploy --dry-run` + `wrangler dev` での表示確認まで完了。
- **Prisma 7 が workerd で動かない**ことが判明 (`Wasm code generation disallowed by embedder`)。
  認証・監視・API キーの DB 操作は Node 専用。D1 ネイティブ / Drizzle への移行判断が必要で、
  これは PDR の決定ゲート 3 に該当するためユーザー確認待ち。
- 本番デプロイ (D1 `database_id` 発行、シークレット、DNS) は未実施。

## Risks
- tracker.ggの実DOM構造・コンポーネント粒度はHTML 616KBから逆推 — pixel-perfectは限界あり、レイアウト/トークン完全一致を優先
- HenrikDev の実際の制限はプラン/キャッシュ状態で変わる。RateLimit ヘッダーに従う
- Discord OAuthはdev用にユーザー側でDiscord Developer App作成が必要 (client id/secret → .env)
- ネストプロジェクト: 親 package-lock によるturbopack root警告 → `turbopack.root` 設定で解決
- Cloudflare Workers は `better-sqlite3` を本番 DB として使えない。D1 対応実装へ置換する
