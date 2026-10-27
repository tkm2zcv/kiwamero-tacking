# Tracker Sites Analysis — Design Systems & Features

Scraped 2026-10-27 via Scrapling StealthyFetcher (Camoufox). Raw artifacts: `docs/research/*.html`, `*-tokens.json`, `*-css-*.css`; screenshots in `docs/screenshots/`.

---

## 1. tracker.gg (Tracker Network)

**Stack**: Server-rendered + custom CSS vars. Font: **Poppins** (nav/UI), Roboto fallback.

### Design tokens (extracted)
| Token | Value |
|---|---|
| `--color-background` | `#0F141A` |
| `--color-main-nav-background` | `#0F1923` |
| `--color-game-bar-background` | `#000000` |
| `--color-text-primary` | `#efefef` |
| `--color-text-secondary` | `#99ABBF` |
| `--color-text-tertiary` | `#667280` |
| `--color-action` | `#FF4655` (Valorant red) |
| `--color-accent` | `#BFBDB6` |
| body font-size | 15px |

### Layout
- **Top game bar** (black): logo + game switcher (Fortnite, Valorant, R6, Marvel Rivals, GTA6, Apex, RL, LoL, Roblox, Deadlock, More Games) + Get Premium + Sign In
- **Sub nav** (`#0F1923`): search, Home, Leaderboards▾, Lineups, Premier, Rank Me `NEW`, LFG `124`, Insights, Crosshairs, Premium▾, OBS Overlay, Get the Apps▾, Daily XP
- **Profile hero**: agent splash art (right-aligned), circular avatar card, name+tag, view count (372,869), platform chips, social share (X/Twitch/share), Live Update toggle
- **Profile tabs**: Overview, Matches, Performance, Agents, Maps, Weapons, Encounters `NEW`, Customs, Crosshairs, Lineups
- **Playlist segmented filters**: PC/Console | Competitive/Premier/Unrated/Deathmatch/Swiftplay | All Acts/V26:A6
- **Current Rating card**: rank icon + Radiant 788 RR + #26 + Peak Rating Radiant 1,118 RR
- **Competitive Overview panel**: big rating + level + W/L donut + RR sparkline graph; stat tiles w/ percentile ("Damage/Round 178.8 Top 6.0%"); secondary grid (Wins, KAST, DDA/R, Kills, Deaths, Assists, ACS, KAD, Kills/Round, First Bloods, Flawless, Aces)
- **Premier Roster card**, ad/premium upsell slots

### Key features
Leaderboards (rank/region filters Iron→Radiant, NA/EU/AP/KR/BR/LATAM), LFG, Insights, Crosshairs DB, Lineups, Premier, Rank Me, OBS overlay, premium subs, per-agent/map/weapon stat pages, encounters (who you play with/against).

---

## 2. vtl.lol (ValoTool Lookup)

**Stack**: SvelteKit + Bootstrap 5 + Bootstrap Icons + Google AdSense. Font: **Inter** (self-hosted ttf). letter-spacing .6px.

### Design
- Body bg `rgb(33,37,41)` (#212529 Bootstrap dark), text `#adb5bd`
- Cyan/teal accent chips: `badge bg-info text-dark` for stats, `bg-success`/`bg-danger` for W/L & RR +/-
- Beta notice alert bar (green) w/ Discord link
- Border-radius 6px (Bootstrap default), pill badges

### Layout / features
- **Player card**: wide banner image, name#tag, badges: Level 926, region (AP), Radiant (788 RR) + rank img, **Elo: 2888**, **Peak Radiant (E1A2)**, **2794 Wins in Radiant**; PUUID chip click-to-copy; TRN badge; "Last updated X minutes ago"
- **Filters**: playlist select (Competitive…), act select (Show All Acts)
- **Competitive Stats row**: chips — K/D 1.27, HS% 29.26, ACS 268.1, ADR 171, Winrate 56.4, Matches 2125 (1199W/922L/4D), Agent Jett, Server Tokyo
- **Match cards** (map art bg): badges [Competitive] [Map] [score 13-7] [**+19 RR** green / **-16** red] [rank icon] — right: server chip, timestamp GMT, Tracker.gg link, expand chevron
- Expanded/under row: K/D/A, agent icon+name, match UUID (click-copy), Score, current RR+Elo, DMG dealt/received, ADR, Season (E11A6), HS% triple (head/body/leg), team color, game version
- Footer: Discord/email/home links

---

## 3. tracker.valosmurf.net — **KiwameroTracker** (target/own product)

**Stack**: Next.js + Tailwind v4 + shadcn-style tokens. Fonts: **Outfit / Noto Sans JP / Geist / Geist Mono**. Ja UI. Discord OAuth gated.

### Design tokens (lab→approx hex)
| Token | lab | ≈hex |
|---|---|---|
| `--background` | 2.73% L | `#0a0a0b` |
| `--card`/`--popover` | 5.68% L | `#131316` |
| `--muted`/`--secondary`/`--accent` | 11.79% L | `#1f1f23` |
| `--border`/`--input` | 14.11% L | `#28282d` |
| `--foreground`/`--primary` | 98.26% L | `#fafafa` |
| `--muted-foreground` | 62.81% L | `#a0a0a8` |
| `--destructive` | red | `#e5484d`-ish |
| `--ring` | 30.31% L | `#4f4f57` |
| `--radius` | .5rem |  |
| Brand blue (logo chip) | — | `#2563eb`-ish blue |
| Win/Loss | — | emerald `#34d399` / red `#f87171` |

Body: `bg-background text-foreground min-h-screen flex flex-col antialiased overflow-x-hidden`

### Pages & features (confirmed by login capture)
- **/login**: centered card — lock icon box, "ログイン", "Discord アカウントでログインしてトラッカーを開始します。", Discord-blurple `#5865F2` rounded-xl button
- **/** (home): centered hero — blue poker-chip logo (極), "KiwameroTracker" wordmark, search input `Player#TAG または PUUID` + search button; top-right user chip (avatar + name + ▾)
- **/tracker/[name]/[tag]**:
  - ← Back to Search; user chip top-right
  - **Hero card**: player card banner art bg, round avatar, name#tag, `Lvl. 926` `AP` chips; actions: `☆監視対象に追加` `↻最新戦績を取得` `戦績カードを共有`(white pill); `LAST UPDATED 35 minutes ago`
  - **Tabs**: 試合履歴 500 | アナリティクス 337 | シーズンランク 39 | アカウント査定 | スマーフ診断 (active = white pill, inactive = ghost)
  - **Left col**: Top Agents card (icon, name, N matches, Win % green); よく組むメンバー card (avatar, name#tag, N試合(W-L), 勝率%, K/D) + すべて見る
  - **Main**: 勝率(N試合) big % + W-L counts; `AA戦績コピー (直近20)` btn; stat grid: K/D比(+raw K/D/A), 平均ACS, 平均ADR, ヘッドショット率
  - **Filters**: Show All Gamemodes / Acts / Agents / Maps dropdown pills
  - **Match cards**: map art bg, left accent border (green win/red loss), agent icon, map name, MODE・Tokyo, `ロビー: Immo 3 (Immo 2 〜 Radiant)`, score 13:7, VICTORY/DEFEAT/Team Victory/1st Pos, KDA, KDR(color-coded), ACS, HS%, rank icon, date+relative time, share + expand btns; TDM shows 90:100 etc, DM shows 1st Pos + score
  - **Pagination**: « 前へ 1 2 3 … 25 次へ » + "全500試合中 1〜20件を表示中 (ページ 1/25)"
- **/developers**: ←ホームへ戻る, "Developer Portal" badge; 開発者ポータル h1, tabs: APIキー / プレイグラウンド / ドキュメント; key issuance (name input + 発行 btn); empty state "キーはまだありません"
- **Footer**: logo, ホーム | API キー & ドキュメント, © 2026, Riot non-affiliation disclaimer

---

## Merge strategy for kiwamero-tracker

Base = KiwameroTracker design (black + Tailwind tokens + Outfit/NotoSansJP). Borrow:
- tracker.gg: percentile "Top X%" stat chips, profile tab structure (Overview/Matches/Agents/Maps/Weapons), RR sparkline graph, rank progress card
- vtl.lol: Elo display, peak rank badges, +RR/-RR per match, expandable match detail rows (HS% split, DMG, season, version), click-copy PUUID, competitive stats chip row
