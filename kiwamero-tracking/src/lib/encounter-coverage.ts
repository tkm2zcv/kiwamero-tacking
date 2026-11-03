import type { Locale } from "./i18n/dict";

export interface EncounterCoverage {
  covered: number; total: number; allActs: boolean; recentTotal: number; recentCovered: number;
  pending: number; olderMissing: number; unavailable: number; blocked: boolean; loaded: boolean;
}

export function encounterCoverageText(locale: Locale, c: EncounterCoverage): string {
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
  if (!c.loaded) return L(
    "保存データを読み込めませんでした。再試行してください。未取得の試合を「遭遇なし」とは扱いません。",
    "Archive could not be read. Please retry. Missing details do not mean no encounters.",
  );
  const parts = [
    L(`${c.total}試合中、詳細取得済みの${c.covered}試合から遭遇を集計しています${c.allActs ? "（全期間）" : ""}。`,
      `Encounters are computed from ${c.covered} of ${c.total} matches${c.allActs ? " (all stored history)" : ""}.`),
    L(`自動取得は全モード通算の直近${c.recentTotal}試合が対象です（保存済み${c.recentCovered}試合）。`,
      `Auto-retrieval covers the latest ${c.recentTotal} matches across all playlists (${c.recentCovered} saved).`),
  ];
  if (c.pending > 0) parts.push(c.blocked
    ? L("取得エラーのため、補完を一時停止しています。", "Retrieval is paused after an error.")
    : L(`残り${c.pending}試合の詳細はバックグラウンドで取得します。`,
      `${c.pending} remaining recent matches await background retrieval.`));
  if (c.olderMissing > 0) parts.push(L(`過去の未保存${c.olderMissing}試合は自動取得の対象外です。`,
    `${c.olderMissing} older unsaved matches are outside automatic retrieval.`));
  if (c.unavailable > 0) parts.push(L(`詳細を取得できない試合：${c.unavailable}試合。`, `Unavailable details: ${c.unavailable}.`));
  parts.push(L("未取得・取得不可は「遭遇なし」を意味しません。", "Missing details do not mean no encounters."));
  return parts.join(" ");
}
