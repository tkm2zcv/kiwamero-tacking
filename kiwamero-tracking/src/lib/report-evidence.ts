/**
 * Evidence blocks for the account report, all derived from the stored
 * lifetime match rows (self stats only — no roster data needed).
 */
import type {
  ActHistoryRow, ClusterEvidence, EarlyRecentComparison, LifetimeGenealogy, StatBlock,
} from "./report-model";
import type { SeasonRank } from "./types";
import type { StoredRow } from "./stored-stats";
import { normalizeCluster } from "./henrik-shared.ts";

export const MIN_AUDIT_MATCHES = 40;
const KD_JUMP = 0.4;
const ACS_JUMP = 60;
const HS_JUMP = 8;

export function statBlock(rows: StoredRow[]): StatBlock {
  let kills = 0, deaths = 0, score = 0, rounds = 0,
    head = 0, shots = 0, wins = 0, decided = 0, accuracyCount = 0;
  const agents = new Map<string, number>();
  for (const r of rows) {
    kills += r.kills; deaths += r.deaths; score += r.score; rounds += r.rounds;
    if (r.accuracyAvailable !== false && r.head + r.body + r.leg > 0) {
      head += r.head; shots += r.head + r.body + r.leg; accuracyCount++;
    }
    if (r.result === "win") { wins++; decided++; } else if (r.result === "loss") decided++;
    if (r.agent) agents.set(r.agent, (agents.get(r.agent) ?? 0) + 1);
  }
  const topAgents = [...agents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return {
    count: rows.length,
    kd: deaths ? kills / deaths : kills,
    acs: rounds ? score / rounds : 0,
    hsRate: shots ? (head / shots) * 100 : 0,
    accuracyCount,
    winRate: decided ? (wins / decided) * 100 : 0,
    topAgents,
    meanTier: rows.filter((r) => r.tier >= 3 && r.tier <= 27)
      .reduce((sum, r, _, list) => sum + r.tier / list.length, 0),
  };
}

/** Oldest half vs newest half of the stored history. */
export function earlyRecentComparison(rows: StoredRow[]): EarlyRecentComparison {
  const sorted = [...rows].sort((a, b) => a.startedAt - b.startedAt);
  const half = Math.floor(sorted.length / 2);
  const before = statBlock(sorted.slice(0, half));
  const after = statBlock(sorted.slice(half));
  const kdDiff = +(after.kd - before.kd).toFixed(2);
  const acsDiff = Math.round(after.acs - before.acs);
  const hsDiff = +(after.hsRate - before.hsRate).toFixed(1);
  const comparable = before.count >= 20 && after.count >= 20 &&
    before.meanTier >= 3 && after.meanTier >= 3 &&
    Math.abs(before.meanTier - after.meanTier) <= 2 &&
    [sorted.slice(0, half), sorted.slice(half)].every((period) => {
      const tiers = period.filter((r) => r.tier >= 3 && r.tier <= 27).map((r) => r.tier);
      // A mixed low/high-rank window can have a deceptively similar mean.
      return tiers.length / period.length >= 0.8 && Math.max(...tiers) - Math.min(...tiers) <= 4;
    }) &&
    sorted.every((r) => r.rounds > 0 && r.accuracyAvailable !== false && r.head + r.body + r.leg > 0);
  return {
    kind: "early_recent",
    comparable,
    hasTransition: comparable && (
      Math.abs(kdDiff) >= KD_JUMP || Math.abs(acsDiff) >= ACS_JUMP || Math.abs(hsDiff) >= HS_JUMP
    ),
    before, after, hsDiff, acsDiff, kdDiff,
  };
}

function clusterCounts(rows: StoredRow[]): Map<string, number> {
  const acc = new Map<string, number>();
  for (const r of rows) {
    const cluster = normalizeCluster(r.cluster);
    if (!cluster) continue;
    acc.set(cluster, (acc.get(cluster) ?? 0) + 1);
  }
  return acc;
}

function topKey(counts: Map<string, number>): string {
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

export function buildGenealogy(
  rows: StoredRow[],
  self: { name: string; tag: string },
): LifetimeGenealogy {
  const sorted = [...rows].filter((r) => r.startedAt > 0).sort((a, b) => a.startedAt - b.startedAt);
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const edge = Math.min(20, Math.floor(sorted.length / 2));
  const early = clusterCounts(sorted.slice(0, edge));
  const recent = clusterCounts(edge ? sorted.slice(-edge) : []);
  const earliestCluster = topKey(early);
  const recentCluster = topKey(recent);
  const dominant = (counts: Map<string, number>, key: string) =>
    edge >= 20 && (counts.get(key) ?? 0) / edge >= 0.8;
  const breakdown = Object.fromEntries([...clusterCounts(sorted)].sort((a, b) => b[1] - a[1]));
  const months = oldest && newest
    ? Math.max(0, Math.round((newest.startedAt - oldest.startedAt) / (30.44 * 86400)))
    : 0;
  const named = sorted.find((r) => r.selfName && r.selfTag);
  const original = named ? `${named.selfName}#${named.selfTag}` : `${self.name}#${self.tag}`;
  const current = `${self.name}#${self.tag}`;
  return {
    oldestMatchDate: oldest ? new Date(oldest.startedAt * 1000).toISOString().slice(0, 10) : "",
    newestMatchDate: newest ? new Date(newest.startedAt * 1000).toISOString().slice(0, 10) : "",
    lifetimeSpanMonths: months,
    totalLifetimeMatches: rows.length,
    earliestCluster,
    recentCluster,
    hasClusterFlip: Boolean(earliestCluster !== recentCluster &&
      dominant(early, earliestCluster) && dominant(recent, recentCluster)),
    lifetimeClusterBreakdown: breakdown,
    originalName: original,
    currentName: current,
    isRenamed: original.toLowerCase() !== current.toLowerCase(),
    earliestLevel: oldest?.level || undefined,
  };
}

export function buildClusterEvidence(rows: StoredRow[]): ClusterEvidence {
  const byCluster = new Map<string, StoredRow[]>();
  for (const r of rows) {
    const key = normalizeCluster(r.cluster);
    if (!key) continue;
    const list = byCluster.get(key) ?? [];
    list.push(r);
    byCluster.set(key, list);
  }
  const breakdown: Record<string, number> = {};
  const clusters: Record<string, StatBlock> = {};
  for (const [name, list] of byCluster) {
    breakdown[name] = list.length;
    clusters[name] = statBlock(list);
  }
  const home = topKey(clusterCounts(rows));
  const knownMatches = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  return { home, homeMatchCount: breakdown[home] ?? 0, hasClusterFlip: false, breakdown, clusters, knownMatches };
}

/** Per-act rows: final rank + win record, plus the dominant server seen in stored matches. */
export function buildHistory(seasons: SeasonRank[], rows: StoredRow[]): ActHistoryRow[] {
  const serverByAct = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (!r.seasonShort || !r.cluster) continue;
    const key = r.seasonShort.toLowerCase();
    const m = serverByAct.get(key) ?? new Map<string, number>();
    m.set(r.cluster, (m.get(r.cluster) ?? 0) + 1);
    serverByAct.set(key, m);
  }
  return [...seasons]
    .sort((a, b) => actOrder(b.actCode) - actOrder(a.actCode))
    .map((s) => ({
      act: s.actCode,
      tier: s.peakTier,
      rankName: s.peakRank,
      games: s.games ?? 0,
      wins: s.wins ?? 0,
      winRate: s.games ? Math.round(((s.wins ?? 0) / s.games) * 100) : 0,
      primaryServer: topKey(serverByAct.get(s.actCode.toLowerCase()) ?? new Map()),
    }));
}

export function actOrder(code: string): number {
  const m = code.toLowerCase().match(/^e(\d+)a(\d+)$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
}
