import type { SeasonRank } from "./types";
import type { StoredRow } from "./stored-stats";
import { agentRole } from "./rank-benchmarks.ts";

export interface AuditCapabilityMismatch {
  priorTier: number; priorAct?: string; priorGames: number; source: "observed" | "act";
  recentFrom: number; recentTo: number; recentKd: number; recentMeanTier: number;
  halfKd: [number, number]; lowRankMatches: number;
  rankPoints: number; performancePoints: number; gapDays: number; roleChanged: boolean;
}

function actOrder(act: string) {
  const m = /^e(\d+)a([1-6])$/i.exec(act);
  return m ? Number(m[1]) * 10 + Number(m[2]) : null;
}

/** A current capability mismatch is not an abrupt-change/identity detector. */
export function auditCapabilityMismatch(rows: StoredRow[], seasons: SeasonRank[]): AuditCapabilityMismatch | null {
  if (rows.length < 60) return null;
  const recent = rows.slice(-40), prior = rows.slice(0, -40);
  if (prior.at(-1)!.startedAt >= recent[0].startedAt) return null;
  const halves = [recent.slice(0, 20), recent.slice(20)];
  const sums = halves.map((sample) => {
    const low = sample.filter((r) => Number.isInteger(r.tier) && r.tier >= 3 && r.tier <= 14);
    const deaths = sample.reduce((n, r) => n + r.deaths, 0);
    return { low: low.length, deaths, kills: sample.reduce((n, r) => n + r.kills, 0),
      persistent: sample.filter((r) => r.deaths > 0 && r.kills / r.deaths <= 1.2).length,
      tiers: sample.filter((r) => Number.isInteger(r.tier) && r.tier >= 3 && r.tier <= 27).reduce((n, r) => n + r.tier, 0),
      known: sample.filter((r) => Number.isInteger(r.tier) && r.tier >= 3 && r.tier <= 27).length };
  });
  if (sums.some((s) => s.low < 16 || s.deaths < 60 || s.persistent < 12)) return null;
  const halfKd = sums.map((s) => s.kills / s.deaths) as [number, number];
  const recentKd = sums.reduce((n, s) => n + s.kills, 0) / sums.reduce((n, s) => n + s.deaths, 0);
  if (recentKd > 1.05 || halfKd.some((n) => n > 1.1)) return null;

  const observed = prior.filter((r) => Number.isInteger(r.tier) && r.tier >= 24 && r.tier <= 27);
  let reference: Pick<AuditCapabilityMismatch, "source" | "priorTier" | "priorGames" | "priorAct"> | null =
    observed.length >= 10 ? { source: "observed", priorTier: Math.min(...observed.map((r) => r.tier)),
      priorGames: observed.length } : null;
  const currentActs = recent.map((r) => actOrder(r.seasonShort)).filter((n) => n !== null);
  if (!reference && currentActs.length === recent.length) {
    // Pre-Ascendant ACTs use different tier meanings; do not infer modern Immortal from them.
    const candidates = seasons.filter((s) => {
      const order = actOrder(s.actCode);
      return order !== null && order >= 51 && order < Math.min(...currentActs) &&
        Number.isInteger(s.peakTier) && s.peakTier >= 24 && s.peakTier <= 27 &&
        typeof s.games === "number" && Number.isInteger(s.games) && s.games >= 20 && s.games <= 20000 &&
        typeof s.wins === "number" && Number.isInteger(s.wins) && s.wins >= 0 && s.wins <= s.games;
    }).sort((a, b) => b.peakTier - a.peakTier);
    const best = candidates[0];
    if (best) reference = { source: "act", priorTier: best.peakTier, priorGames: best.games!, priorAct: best.actCode };
  }
  if (!reference) return null;
  const lowRankMatches = sums.reduce((n, s) => n + s.low, 0);
  const recentMeanTier = sums.reduce((n, s) => n + s.tiers, 0) / sums.reduce((n, s) => n + s.known, 0);
  if (reference.priorTier - recentMeanTier < 9) return null;
  const mainRole = (sample: StoredRow[]) => {
    const counts = new Map<string, number>();
    for (const r of sample) { const role = agentRole(r.agent); counts.set(role, (counts.get(role) ?? 0) + 1); }
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
  };
  const oldRole = mainRole(observed), newRole = mainRole(recent);
  const roleChanged = reference.source === "observed" && oldRole !== "unknown" && newRole !== "unknown" && oldRole !== newRole;
  return { ...reference, recentFrom: recent[0].startedAt, recentTo: recent.at(-1)!.startedAt,
    recentKd, halfKd, recentMeanTier, lowRankMatches, rankPoints: 20, roleChanged,
    performancePoints: (recentKd <= 0.85 && halfKd.every((n) => n <= 0.9) ? 55 : 35) - (roleChanged ? 10 : 0),
    gapDays: rows.slice(1).reduce((n, r, i) => Math.max(n, (r.startedAt - rows[i].startedAt) / 86400), 0) };
}
