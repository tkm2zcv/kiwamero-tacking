# KiwameroTracker Implementation Plan

## Overview
Rebuild the Valorant tracker UI (KiwameroTracker) locally, cloning design systems + features from tracker.gg, vtl.lol, and tracker.valosmurf.net. Research: `docs/research/tracker-sites-analysis.md`.

## Stack
Next.js (App Router) + TypeScript + Tailwind CSS v4 — matches production stack. Fonts: Outfit, Noto Sans JP, Geist/Geist Mono.

## Design tokens
Black theme: `--background lab(2.73 .24 -.94)`, `--card lab(5.68 .48 -1.83)`, `--muted lab(11.79 .58 -2.18)`, `--border lab(14.11 .58 -2.18)`, `--foreground lab(98.26 0 0)`, `--muted-foreground lab(62.81 .75 -2.92)`, `--radius .5rem`. Discord `#5865F2`, win emerald / loss red, brand blue chip logo.

## Phases
| # | Phase | Status |
|---|-------|--------|
| 1 | Scaffold Next.js + tokens/fonts | done |
| 2 | Seed real data (extracted from captures: Meiy profile, agents, matches) | done |
| 3 | Layout shell: footer, user chip, login page, search home | done |
| 4 | /tracker/[name]/[tag] — hero, tabs, side cards, stats, filters, match cards, pagination | done |
| 5 | /developers portal (tabs: APIキー/プレイグラウンド/ドキュメント) | done |
| 6 | tracker.gg/vtl enhancements: expandable match detail roster done; percentile/Elo/±RR chips — future | partial |
| 7 | Build check + screenshot compare | done (lint 0 / build ok / pixel-close) |

## Data
Real data extracted from production DOM (`docs/research/valosmurf-app-main.html`) → `src/data/meiy-profile.ts`. 20 matches page-1, 500 total / 25 pages.

## Key files
- `src/app/layout.tsx`, `globals.css` (tokens)
- `src/app/page.tsx` (search home), `login/page.tsx`, `tracker/[name]/[tag]/page.tsx`, `developers/page.tsx`
- `src/components/{site-header,user-chip,site-footer,logo}.tsx`
- `src/components/tracker/{profile-hero,tracker-tabs,top-agents,teammates,stats-summary,match-filters,match-card,match-list,pagination}.tsx`
- `src/components/developers/{api-keys,playground,docs-view}.tsx`
