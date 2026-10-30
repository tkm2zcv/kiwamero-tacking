import type { Match } from "./types";
import type { StoredRow } from "./stored-stats";

export const MIN_DIAGNOSIS_MATCHES = 10;
export const DIAGNOSIS_DETAIL_CAP = 10;
const WINDOW_SECONDS = 90 * 86400;

export interface MatchSample {
  matchId: string;
  lobbyTier: number;
  selfTier: number;
  agent: string;
  result: "win" | "loss" | "draw";
  kills: number; deaths: number; score: number; rounds: number;
  head: number; shots: number;
  opponents: { puuid: string; tier: number }[];
}

/** Require complete team/metric data; identify the owner by immutable PUUID. */
export function sampleMatches(matches: Match[], selfKey: string): MatchSample[] {
  const samples: MatchSample[] = [];
  const seen = new Set<string>();
  for (const m of [...matches].sort((a, b) => a.metadata.game_start - b.metadata.game_start)) {
    if ((m.metadata.mode_id || m.metadata.mode || "").toLowerCase() !== "competitive" ||
      !m.metadata.matchid || seen.has(m.metadata.matchid)) continue;
    seen.add(m.metadata.matchid);
    const self = m.players.find((p) => p.puuid === selfKey);
    const selfTeam = self?.team_id?.toLowerCase();
    const rounds = m.metadata.rounds_played;
    if (!self || (selfTeam !== "red" && selfTeam !== "blue") ||
      !Number.isFinite(rounds) || rounds < 5 || rounds > 60 ||
      m.players.length !== 10 || new Set(m.players.map((p) => p.puuid)).size !== 10 ||
      !m.players.every((p) => p.puuid) ||
      ["red", "blue"].some((team) => m.players.filter((p) => p.team_id?.toLowerCase() === team).length !== 5)) continue;
    const validTier = (t?: number): t is number => Number.isInteger(t) && t! >= 3 && t! <= 27;
    const others = m.players.filter((p) => p !== self);
    const tiered = others.filter((p) => validTier(p.currenttier));
    if (tiered.length < 6 || !validTier(self.currenttier)) continue;
    const opponents = others
      .filter((p) => p.team_id?.toLowerCase() !== selfTeam && validTier(p.currenttier))
      .map((p) => ({ puuid: p.puuid, tier: p.currenttier! }));
    const head = self.stats.headshots ?? 0;
    const shots = head + (self.stats.bodyshots ?? 0) + (self.stats.legshots ?? 0);
    const own = m.teams[selfTeam];
    const other = m.teams[selfTeam === "red" ? "blue" : "red"];
    if (!own || !other || ![own.rounds_won, other.rounds_won, self.stats.kills,
      self.stats.deaths, self.stats.score, self.stats.headshots, self.stats.bodyshots, self.stats.legshots]
        .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0) ||
      shots <= 0 || self.stats.score <= 0 ||
      own.rounds_won + other.rounds_won !== rounds) continue;
    samples.push({
      matchId: m.metadata.matchid,
      lobbyTier: tiered.reduce((s, p) => s + p.currenttier!, 0) / tiered.length,
      selfTier: self.currenttier, agent: self.character,
      result: own.rounds_won === other.rounds_won ? "draw" : own.rounds_won > other.rounds_won ? "win" : "loss",
      kills: self.stats.kills ?? 0,
      deaths: self.stats.deaths ?? 0,
      score: self.stats.score ?? 0,
      rounds,
      head, shots,
      opponents,
    });
  }
  return samples;
}

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
