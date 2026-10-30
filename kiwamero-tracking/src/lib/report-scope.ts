import type { Match } from "./types";
import type { StoredRow } from "./stored-stats";
import { sampleMatches } from "./lobby-analysis.ts";

export const MIN_DIAGNOSIS_MATCHES = 10;
export const DIAGNOSIS_DETAIL_CAP = 10;
const WINDOW_SECONDS = 90 * 86400;

export function recentReportRosters(matches: Match[], generatedAt: string): Match[] {
  const now = Date.parse(generatedAt) / 1000;
  const seen = new Set<string>();
  return matches
    .filter((m) => m.metadata.game_start > now - WINDOW_SECONDS && m.metadata.game_start <= now)
    .sort((a, b) => b.metadata.game_start - a.metadata.game_start || b.players.length - a.players.length)
    .filter((m) => {
      const id = m.metadata.matchid;
      if (!id || seen.has(id) ||
        (m.metadata.mode_id || m.metadata.mode || "").toLowerCase() !== "competitive") return false;
      seen.add(id);
      return true;
    }).slice(0, 25);
}

/** Top up only a missing minimum sample, never backfill every stored match. */
export function selectDiagnosisDetailIds(
  rows: StoredRow[], matches: Match[], puuid: string, generatedAt: string,
): string[] {
  const recent = recentReportRosters(matches, generatedAt);
  const valid = sampleMatches(recent, puuid);
  const missing = Math.max(0, MIN_DIAGNOSIS_MATCHES - valid.length);
  if (!missing) return [];
  // A couple of spare candidates tolerate unavailable/invalid details without
  // repeatedly refetching an already complete but unsuitable recent roster.
  const budget = Math.min(DIAGNOSIS_DETAIL_CAP, missing + 2);
  const now = Date.parse(generatedAt) / 1000;
  if (!Number.isFinite(now)) return [];
  const seen = new Set(recent.filter((m) => m.players.length > 1).map((m) => m.metadata.matchid));
  return [...rows].sort((a, b) => b.startedAt - a.startedAt).filter((r) => {
    if (!r.id || seen.has(r.id) || r.mode.toLowerCase() !== "competitive" ||
      r.startedAt <= now - WINDOW_SECONDS || r.startedAt > now || !Number.isFinite(r.startedAt)) return false;
    seen.add(r.id);
    return true;
  }).slice(0, budget).map((r) => r.id);
}
