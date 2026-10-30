# tracker.gg VALORANT プロフィール デザイン監査レポート

Scrapling (StealthySession) で本番DOM・スタイルシート・計算済みトークンを抽出した結果のまとめ。
対象: `https://tracker.gg/valorant/profile/riot/Meiy%23B3L` の Overview / Matches / Performance / Agents / Maps / Encounters（`platform=pc&playlist=competitive&season=8102cd81-...`）。デスクトップ基準。

抽出物は `docs/research/capture/` の `x-{tab}-html.html`（実DOM）・`x-{tab}-rules.css`（適用ルール）・`x-{tab}-vars.json`・`audit-*.json`・`ref-*.png`。

---

## 1. デザイントークン（実測値）

### カラー（431 変数中の主要分）

| 用途 | 変数 | 値 |
|---|---|---|
| ページ背景 | `--color-background` | `#0F141A` |
| カード面 L1/L2/L3 | `--color-surface-1/2/3` | `#0f1923` / `#1b2733` / `#2c3f52` |
| 本文 | `--color-text-primary` | `#efefef` |
| 副次 | `--color-text-secondary` | `#99ABBF` |
| 三次 | `--color-text-tertiary` | `#667280` |
| アクション(赤) | `--color-action` | `#FF4655`（VALORANTレッド） |
| ハイライト金 | `--color-gold` | `#cbb765` |
| 勝ち/増分 | `--color-green` | `#5ee790` |
| 負け/減分 | `--color-red` | `#e4485d` |
| 青情報 | `--color-blue` | `#3ecbff` |
| アクセント(無彩) | `--color-accent` | `#BFBDB6` |
| 警告 | `--color-warning` | `#e89725` |

- 各カラーに `--color-rgb-*` の生RGB三つ組があり、`rgb(var(--color-rgb-x)/.5)` 形式で透明度を重ねる方式。
- ランク色: `--color-iron #66605c`, `--color-bronze #a86243`, `--color-gold #cbb765`, `--color-platinum #3ecbff`, 各4段階バリエーション（*-1..*-4）+ diamond/ascendant/immortal/radiant系。
- エピソード色（st-vpp列）: `#648FFF #DC267F #FFB000 #FE6100 #785EF0 #29A634` 系を `--episode-color`（アルファ付hex）で行ごとに付与。
- エージェント色: `--agent-color`（実hex）＋ `--agent-color-opacity-25`（25%アルファ）を行/チップに付与。
- 勝敗リング: `#007e62`（win）/ `#952030`（loss）。
- プラットフォーム色、Deadlock系、トースト系などゲーム横断の大規模パレットも定義済み。

### タイポグラフィ

- **UI/本文/数値**: `Roboto, -apple-system, ...` スタック。
- **見出し・表示数字**: `Saira, Roboto, ...`（カードタイトル・LIFETIME透かし・大きな統計値）。
- プレイヤー名: Roboto 500 / 32px（Sairaではない）。
- カードタイトル: Saira 500-600 / 18-20px / **uppercase**。
- サイズ階層（使用値から）: 0.625 / 0.75 / 0.875 / 1 / 1.125 / 1.25 / 1.5 / 2 / 2.5 / 6.5rem。
- テーブルヘッダー: 0.75rem / secondary色 / line-height 1。
- セル値: `.info .value` = font-weight 500、1rem 系。`.small` = 0.625rem。

### 形状・余白

| 項目 | 値 |
|---|---|
| カード角丸 | `1rem`（rounded-4）＋ border 1px + shadow `0 8px 16px rgba(0,0,0,.25)` |
| 基本角丸 | `--border-radius: 0.5rem`、チップ/タイル `0.25rem`（rounded-md=0.375remも） |
| `.st` 行高 | デスクトップ `3.5rem` / モバイル `3rem`（`--st-row-height(_mobile)`） |
| 行間隔 | `--st-gap: .125rem`（st-vppは0） |
| `.st` 最小幅 | `--st-min-width: 6rem`、基準幅 `--st-base-width: 8rem` |
| コンテナ | 約1392-1400px / 中央寄せ |
| レイアウト | サイドバー ~300px + 主カラム（gap 24px） |
| ヒーロー | カード 320px (`h-80`) + ブラー背景層 496px (`h-124`)、object-position `center 15%` |

### ブレークポイント（実メディアクエリから）

- 主要: `640 / 864 / 1024 / 1600px` 他、499/599/767/799/863/899/999/1150/1299/1312/1432等の細粒度。
- 重要な挙動: **`hidden-desktop` = `min-width:1024px` で `display:none`**（デスクトップではテーブルの副次列を隠す）。モバイル(`<1024px`)では行3rem・画像2rem・expand列非表示・値1.125rem。

---

## 2. コンポーネント構造

### ページ共通

- `main .trn-profile` → hero（`gradient-image--blur` 背景層 + `header.h-80.rounded-4`）→ フィルタバー → 2カラム。
- ヒーロー: エージェント別画像 `hero-{agent}.jpg` を `object-cover object-[center_15%]`。背景層は同画像を `blur(20px) opacity .35` + `--fade-*` グラデーションマスク。
- アバター 96px（playercard `displayicon` 円形 + 国旗badge）、名前ブロック `ml-36 py-2`、Views行（目アイコン+カウント）。
- タブバー: Overview..Lineups 10個 + Encounters `NEW` バッジ。アクティブは赤下線。

### `v3-card`（全ページの容器）

`v3-card` → `v3-card__header`（`.v3-card__title` Saira uppercase + 右側action）→ 任意 `v3-card__filters`（`.v3-filters` 内の `.v3-filter` ピル）→ `v3-card__body`（`--v2.5`は内パディング抑制、border+radius+shadow）。

### `.st` テーブルシステム（Agents / Maps / Performance 等）

```
.st { --st-base-width:8rem; --st-gap:.125rem; --st-min-width:6rem;
      --st-row-height:3.5rem; display:flex; flex-direction:column; gap:var(--st-gap) }
├ .st-header (min-width:min-content)
│   └ .st__item.st-header__item[--sortable][--active]{min-width:max(base,min); 0.75rem; padding .5rem 1rem}
├ .st-content > .st-content__category
│   └ .st-content__item (flex row, height 3.5rem, bg --item-row-color)
│       └ .st__item.st-content__item-value {min-width:max(base,min); padding 0 1rem; gap .5rem; bg-image対応}
│           └ .image(2.5rem) + .info(.value/.label/.small)
│   └ 行末: .st__item--expand.st-content__item-expand (縮2.5rem, 縦⋮svg → drawer)
└ 修飾子: --sticky(先頭列固定+右16pxグラデ影) / --wide(flex:1 で余白吸収)
         / hidden-desktop(≥1024px非表示) / --scroll(overflow-x:auto)
         / --highlight(金 .st-content__item-value--highlight)
         / --active(ソート列) / 4n+3行=secondary縞模様
```

列幅は全て `--st-base-width` インライン指定（実測: Agent 9.5 / Act 8 / Peak Rating 10 / ADR・ACS 7 / DDΔ 5.5rem等）。**デスクトップでは情報密度の高い列を `hidden-desktop` で非表示**にするのが参照の流儀（Agentsは10列、Mapsは9列のみ表示）。

### `performance`（st-vpp）

- `.performance-content__header`: グラデ面 + `::before` に **"LIFETIME" Saira 4rem 透かし文字**（`-webkit-text-stroke .25pt rgba(255,255,255,.05)`、fill transparent）。
- 行 = `.st.st-vpp`（--st-gap:0）。Episode列は `.st-entry-episode` に `linear-gradient(to right, var(--episode-color), surface-1/2)` の色帯。
- Act列が `--wide`（余白吸収）かつ `--active`。Peak Rating = `.st-entry-rank`（tiersv2 icon + 名前 + `.small` = `788 RR • #21`）。Top Agent = `.st-entry-top-agent`（`--agent-color`色付き .image）。

### Overview 内カード

- `Current Rating` / `Accuracy` / `Roles` / `Top Maps` / `Top Weapons` / `Premier Roster`（サイドバー）。
- `V26: A5 Competitive Overview`（主）: レベル・勝敗ドーナツSVG（clipPath arc + mask ring）+ `giant-stats` タイル群。
- **`stat.giant.expandable`**: `.progress.vertical.small`（縦バー）+ `.numbers`（name+value）+ `.bottom`（`.rank` "Top 7.0%"）+ `.more`（⋮ドロワー）。
- `Last 20 Matches` = `.st` 系行 + `v3-match-row`（勝敗ノッチ・グロー）。

### Matches

- ACTIVITYヒートマップ（週×曜グリッド）+ `acquaintances__list-player`（TEAMMATES: アバター・名前・K/D・勝率）。
- フィルタチップ（`v3-chip`/`v3-filter`）+ 集計ストリップ（W-L%・K/D・ADR・エージェント内訳バー）+ タイムライン + 日別グループ + `v3-match-row`。

### Encounters（別系統のテーブル）

`.st` ではなく **`grid grid-cols-subgrid` の `<table>` コンポーネント**：`repeat(7, minmax(max-content, auto))`、sticky thead（`bg-surface-3` z-10）、先頭 `th` は `sticky left-0`。列: Player / Played With / Player Rank / Player Win Rate / Player K/D / Player Matches / Last Encounter。

---

## 3. デザインアセット（実URL）

| 種別 | URL パターン | 備考 |
|---|---|---|
| ヒーロー背景 | `trackercdn.com/cdn/tracker.gg/valorant/images/heroes/hero-{agent}.jpg` | 29+エージェント分存在確認（waylay〜veto/miks）。`imgsvc` 経由 `max-width(2100),quality(70)` |
| ランクアイコン | `trackercdn.com/cdn/tracker.gg/valorant/icons/tiersv2/{tier}.png` | 27=Radiant等 |
| エージェント | `titles.trackercdn.com/valorant-api/agents/{uuid}/displayicon.png` | imgsvc `max-width(120)` |
| マップ背景 | `trackercdn.com/cdn/tracker.gg/valorant/db/maps/{ver}/{name}.jpg` | stセル `--background-image-url` 背景 |
| 国旗 | `trackercdn.com/cdn/flags/4x3/{cc}.svg` | アバター角badge |
| プレイヤーカード | `titles.trackercdn.com/valorant-api/playercards/{uuid}/displayicon.png` | アバター本体 |
| Tracker Score | `trackercdn.com/cdn/tracker.gg/img/tracker-score/trn-rating-{s,a,b,c,d,1k}.svg` | 未実装（データなし） |
| Premier zone | `trackercdn.com/cdn/tracker.gg/valorant/premier/v2/zones/{zone}.png` | Premier Roster用 |
| ホームヒーロー | `.../valorant/images/valorant-home-hero.jpg` | 変数 `--home-hero-background-*-url` |
| キル系アイコン | `trackercdn.com/cdn/tracker.gg/valorant/icons/{one-kill-icon,medal-first-blood,medal-5k}.png` | drawer内 |

---

## 4. デザイン原則（読み取れた規則）

1. **層状サーフェス**: 背景 `#0F141A` ← surface-1 `#0f1923` ← surface-2 `#1b2733` ← surface-3 `#2c3f52`。テーブル行は4n+3でsurface-2縞。カードは常に `radius 16px + 1px境界 + 0 8px 16px /25% 影`。
2. **フォントの住み分け**: Saira=見出し・ラベル・大型数字のみ / Roboto=それ以外全部。
3. **色の意味論**: 赤#FF4655=アクション/アクティブ・金#cbb765=列最大値/RR/メダル・緑=正値・赤#e4485d=負値・青=情報・secondary=ラベル。
4. **テーブル規約**: 列幅は `--st-base-width` で明示・先頭列sticky+wide・数値列右寄せ・ソート列に `--active`(赤)+chevron・デスクトップは `hidden-desktop` で密度制御・行末expand列でドロワー展開。
5. **装飾的しるし**: エピソード色グラデーション列・エージェント色25%背景チップ・勝敗ドーナツSVG・縦プログレスバー・"LIFETIME"透かし・ヒーロー画像ブラー背景。
6. **誠実な密度**: 情報が多い列はデスクトップで畳み（列を減らして一画面に収める）、不足は行末drawerに逃がす。

---

## 5. 実装マッピング（kiwamero-tracking側）

| 参照要素 | 実装先 |
|---|---|
| 実ルール一式 | `src/app/trn-v3.css`（567+追補ルール・PC規定統一済み） |
| `.st` Agents | `src/components/profile/agents-table.tsx` |
| `.st` Maps | `src/components/profile/maps-table.tsx` |
| st-vpp Performance | `src/components/profile/performance-table.tsx` |
| BEST MATCHES | `src/components/profile/best-matches-card.tsx`（5件） |
| ACTIVITY/TEAMMATES | `activity-card.tsx` / `teammates-card.tsx` |
| Encounters | `encounters-table.tsx`（`.st`構造・全7列・実集計） |
| ヒーロー | `hero.tsx` + `page.tsx`（`hero-{現アクト主エージェント}.jpg`） |
| フォント | `layout.tsx`（Roboto+Saira next/font） |
| Overview他カード | `rating-card/overview-card/top-agents/sidebar-cards/matches-card` |
| 抽出スクリプト | `tools/scrape/{audit-design,extract-tabs,build-v3-css,shoot-url}.py` |

## 6. 未実装要素（データ欠如のため保持しない）

- Tracker Score(TRS) ・ `Top X%` パーセンタイル ・ `#順位`（`788 RR • #21`の`#21`部）
- Playtime列・KAST・Attack/Defense W-L・Aces/Clutches/Thrifty/Flawless/Plants/Defuses
- Premier Roster・Top Weapons・広告スロット・SNSバッジ・Views数値
- `.st`行ドロワー中身（Match Kills Best/First Bloods/Aces + side winrate progress）
- Weapons/Customs/Crosshairs/Lineupsタブ（空状態）

## 2026-10-30: 査定・診断レポートへの適用

- 既存の抽出トークンを再利用: surface-1 `#0f1923`、surface-2 `#1b2733`、
  surface-3 `#2c3f52`、本文`#efefef`、副次`#99abbf`、アクション`#ff4655`。
- 見出しは既存Saira変数、本文はRoboto変数。新たなフォントやUIライブラリは追加しない。
- `v3-card__header`/`v3-card__body`を共有。角丸16px、24px間隔、
  左300pxのサマリーと右の統計/根拠という既存プロフィールの情報構造を継承。
- `report-ui.tsx`は判定リング・横棒・根拠リスト・計算方法の開閉を共通化。
  `report.css`は`.kt-report`へスコープし、他タブの見た目を変えない。
- 767px以下ではサマリー→分析→アカウント情報の順へ変更。
  表は意味的なtableとラベル付きの横スクロール領域を使い、ページ自体ははみ出さない。
- 空状態を実測0と区別。確率分布の棒グラフや未検証のP95/信頼度表示は使わない。
- tracker.ggに同名機能があるという主張ではなく、既存の視覚言語に独自機能を統合。
  検証と制約は`../reports/20261030-account-report-review.md`を参照。

## 付録: 抽出ファイル

`docs/research/capture/`
- `x-overview-html.html` / `x-overview-classes.json` / `x-overview-rules.css` / `x-overview-vars.json`（431変数）
- `x-{agents,maps,encounters,matches}-html.html` 等、`perf-html.html` / `perf-needed.css` / `perf-rules.css`
- `audit-assets.json`（アセットURL一覧）/ `audit-media.json`（全メディアクエリ）/ `audit-fonts.json`（スタック+サイズ）
- `ref-*.png`（各タブの参照スクショ）/`lay-*.png`（ローカル対応版）
