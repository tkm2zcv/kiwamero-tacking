/**
 * Lobby analysis for the smurf diagnosis: bucket sampled full-roster matches
 * by average lobby tier, z-score the player against each band's benchmark,
 * then estimate the "true rank" by maximum-likelihood over bands.
 */
import {
  bandCenter, bandForTier, benchmarkFor, dominantRole, metricSigma,
  type AgentRole, type BandBenchmark,
} from "./rank-benchmarks.ts";
import { tierName } from "./henrikdev.ts";
import type { BandPerformance, LobbyAnalysis, OpponentTiers } from "./report-model";
import type { Match, MatchPlayer } from "./types";

/** Approx. z-score produced by one full tier of skill gap in a lobby. */
const Z_PER_TIER = 0.3;
/** Minimum posterior spread (tiers) for the true-rank estimate. */
const MIN_MLE_SIGMA = 0.45;
const SIGMA_PER_SAMPLE = 1.4;

interface MatchSample {
  lobbyTier: number;
  won: boolean;
  kills: number; deaths: number; score: number; rounds: number;
  head: number; shots: number;
  opponents: { puuid: string; tier: number }[];
}

function isCompetitive(m: Match): boolean {
  return /competitive/i.test(m.metadata.mode_id || m.metadata.mode || "");
}

function selfOf(m: Match, selfKey: string): MatchPlayer | undefined {
  return m.players.find((p) => `${p.name}#${p.tag}`.toLowerCase() === selfKey
    || (selfKey.startsWith("puuid:") && p.puuid === selfKey.slice(6)));
}

/** Extract one competitive sample per roster match. `selfKey` = "name#tag". */
export function sampleMatches(matches: Match[], selfKey: string): MatchSample[] {
  const key = selfKey.toLowerCase();
  const samples: MatchSample[] = [];
  for (const m of matches) {
    if (!isCompetitive(m)) continue;
    const self = selfOf(m, key);
    if (!self) continue;
    const others = m.players.filter((p) => p !== self);
    const tiered = others.filter((p) => (p.currenttier ?? 0) > 0);
    if (tiered.length < 6) continue; // too few ranked players to trust the lobby read
    const selfTeam = self.team_id?.toLowerCase();
    const opponents = others
      .filter((p) => selfTeam && p.team_id && p.team_id.toLowerCase() !== selfTeam && (p.currenttier ?? 0) > 0)
      .map((p) => ({ puuid: p.puuid, tier: p.currenttier! }));
    const won = selfTeam === "red" || selfTeam === "blue" ? m.teams[selfTeam]?.has_won ?? false : false;
    const head = self.stats.headshots ?? 0;
    const shots = head + (self.stats.bodyshots ?? 0) + (self.stats.legshots ?? 0);
    samples.push({
      lobbyTier: tiered.reduce((s, p) => s + p.currenttier!, 0) / tiered.length,
      won,
      kills: self.stats.kills ?? 0,
      deaths: self.stats.deaths ?? 0,
      score: self.stats.score ?? 0,
      rounds: m.metadata.rounds_played || 1,
      head, shots,
      opponents,
    });
  }
  return samples;
}

function evaluation(z: number): BandPerformance["evaluation"] {
  return z >= 0.75 ? "far_above" : z >= 0.25 ? "above_average"
    : z > -0.25 ? "average" : z > -0.75 ? "below_average" : "far_below";
}

function bandPerformance(samples: MatchSample[], role: AgentRole): BandPerformance[] {
  const byBand = new Map<BandBenchmark, MatchSample[]>();
  for (const s of samples) {
    const band = bandForTier(s.lobbyTier);
    const list = byBand.get(band) ?? [];
    list.push(s);
    byBand.set(band, list);
  }
  return [...byBand.entries()].map(([band, list]) => {
    const n = list.length;
    const wins = list.filter((s) => s.won).length;
    const kills = list.reduce((s, m) => s + m.kills, 0);
    const deaths = list.reduce((s, m) => s + m.deaths, 0);
    const score = list.reduce((s, m) => s + m.score, 0);
    const rounds = list.reduce((s, m) => s + m.rounds, 0);
    const head = list.reduce((s, m) => s + m.head, 0);
    const shots = list.reduce((s, m) => s + m.shots, 0);
    const kd = deaths ? kills / deaths : kills;
    const acs = rounds ? score / rounds : 0;
    const hsRate = shots ? (head / shots) * 100 : 0;
    const winRate = n ? (wins / n) * 100 : 0;
    const bench = benchmarkFor(bandCenter(band), role);
    const kdZ = (kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2);
    const acsZ = (acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25);
    const hsZ = (hsRate - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4);
    // Binomial σ around a 50% lobby win rate shrinks as the sample grows.
    const wrZ = (winRate - 50) / (50 / Math.sqrt(n));
    const compositeZ = (kdZ + acsZ + hsZ + wrZ) / 4;
    return {
      bandName: band.band, minTier: band.minTier, maxTier: band.maxTier,
      matchesCount: n, wins, losses: n - wins, winRate: +winRate.toFixed(1),
      kd: +kd.toFixed(2), acs: Math.round(acs), hsRate: +hsRate.toFixed(1),
      benchmark: {
        meanKd: bench.meanKd, p95Kd: bench.p95Kd, meanAcs: bench.meanAcs,
        p95Acs: bench.p95Acs, meanHs: bench.meanHs, p95Hs: bench.p95Hs,
      },
      zScores: {
        kdZ: +kdZ.toFixed(2), acsZ: +acsZ.toFixed(2), hsZ: +hsZ.toFixed(2),
        wrZ: +wrZ.toFixed(2), compositeZ: +compositeZ.toFixed(2),
      },
      evaluation: evaluation(compositeZ),
    } satisfies BandPerformance;
  }).sort((a, b) => a.minTier - b.minTier);
}

function opponentTiers(samples: MatchSample[]): OpponentTiers {
  const seen = new Map<string, number>(); // puuid → latest tier
  for (const s of samples) for (const o of s.opponents) seen.set(o.puuid, o.tier);
  const tiers = [...seen.values()].filter((t) => t > 0).sort((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const t of tiers) counts.set(t, (counts.get(t) ?? 0) + 1);
  const total = tiers.length;
  const avg = total ? tiers.reduce((a, b) => a + b, 0) / total : 0;
  const median = total ? (total % 2 ? tiers[(total - 1) / 2] : (tiers[total / 2 - 1] + tiers[total / 2]) / 2) : 0;
  const named = (t: number) => t > 0 ? `${tierName(Math.round(t))}${t % 1 ? ` (Tier ${t.toFixed(1)})` : ""}` : "—";
  return {
    totalOpponents: total,
    tierCounts: Object.fromEntries(counts),
    minTier: tiers[0] ?? 0, maxTier: tiers[total - 1] ?? 0,
    avgTier: +avg.toFixed(1), medianTier: median,
    minTierName: named(tiers[0] ?? 0), maxTierName: named(tiers[total - 1] ?? 0),
    avgTierName: named(+avg.toFixed(1)),
    tierDistribution: [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([tier, count]) => ({
      tier, tierName: tierName(tier), count, percentage: +((count / total) * 100).toFixed(1),
    })),
  };
}

export interface LobbyResult {
  analysis: LobbyAnalysis;
  bands: BandPerformance[];
  role: AgentRole;
  /** Precision-weighted MLE estimate of the true tier + its sigma. */
  estimate: { tier: number; sigma: number };
}

export function analyzeLobby(
  matches: Match[],
  selfKey: string,
  topAgents: [string, number][],
  locale: "en" | "ja",
): LobbyResult {
  const samples = sampleMatches(matches, selfKey);
  const role = dominantRole(topAgents);
  const bands = bandPerformance(samples, role);
  const opponents = opponentTiers(samples);
  const avgLobby = samples.length
    ? samples.reduce((s, m) => s + m.lobbyTier, 0) / samples.length : 0;

  // Aggregate player stats across the sampled matches.
  const n = samples.length;
  const kills = samples.reduce((s, m) => s + m.kills, 0);
  const deaths = samples.reduce((s, m) => s + m.deaths, 0);
  const score = samples.reduce((s, m) => s + m.score, 0);
  const rounds = samples.reduce((s, m) => s + m.rounds, 0);
  const head = samples.reduce((s, m) => s + m.head, 0);
  const shots = samples.reduce((s, m) => s + m.shots, 0);
  const kd = deaths ? kills / deaths : kills;
  const acs = rounds ? score / rounds : 0;
  const hsRate = shots ? (head / shots) * 100 : 0;
  const winRate = n ? (samples.filter((s) => s.won).length / n) * 100 : 0;

  const bench = benchmarkFor(avgLobby || 12, role); // no samples → neutral Gold anchor
  const kdZ = n ? (kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2) : 0;
  const acsZ = n ? (acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25) : 0;
  const hsZ = n ? (hsRate - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4) : 0;
  const wrZ = n ? (winRate - 50) / (50 / Math.sqrt(n)) : 0;
  const compositeZ = n ? (kdZ + acsZ + hsZ + wrZ) / 4 : 0;

  // Per-band MLE: a player of true tier t shows z ≈ (center(t) − lobbyCenter)/Z_PER_TIER.
  let estTier = avgLobby;
  let estSigma = 3;
  const weighted = bands.filter((b) => b.matchesCount > 0);
  if (weighted.length && avgLobby > 0) {
    let num = 0, den = 0;
    for (const b of weighted) {
      const sigmaB = Math.max(MIN_MLE_SIGMA, SIGMA_PER_SAMPLE / Math.sqrt(b.matchesCount));
      const tHat = (b.minTier + b.maxTier) / 2 + b.zScores.compositeZ / Z_PER_TIER;
      const w = 1 / (sigmaB * sigmaB);
      num += tHat * w; den += w;
    }
    estTier = num / den;
    estSigma = Math.max(MIN_MLE_SIGMA, 1 / Math.sqrt(den));
  }

  const parity = evaluation(compositeZ);
  const lo = samples.length ? Math.min(...samples.map((s) => s.lobbyTier)) : 0;
  const hi = samples.length ? Math.max(...samples.map((s) => s.lobbyTier)) : 0;
  const name = (t: number) => (t > 0 ? `${tierName(Math.round(t))} (Tier ${t.toFixed(1)})` : "—");
  const estName = tierName(Math.round(Math.min(27, Math.max(3, estTier)))) || "—";
  const performanceDescription = !n ? "" : locale === "ja"
    ? `対戦ロビー平均（${tierName(Math.round(avgLobby))}帯・${roleLabel(role)}基準）の戦闘効率に対し ${parityLabel(parity, "ja")}（勝率 ${winRate.toFixed(0)}%）。最尤推定の実力ランクは ${estName}。`
    : `Combat performance vs the lobby average (${tierName(Math.round(avgLobby))} band, ${role} baseline) is ${parityLabel(parity, "en")} (win rate ${winRate.toFixed(0)}%). MLE-estimated true rank: ${estName}.`;

  return {
    bands, role, estimate: { tier: estTier, sigma: estSigma },
    analysis: {
      sampledMatches: n,
      avgLobbyTier: +avgLobby.toFixed(1),
      avgLobbyTierName: name(avgLobby),
      tierSpan: n ? `${tierName(Math.round(lo))} 〜 ${tierName(Math.round(hi))}` : "—",
      combatParity: parity,
      performanceDescription,
      relativeStats: n ? {
        kdDelta: +(kd - bench.meanKd).toFixed(2),
        acsDelta: Math.round(acs - bench.meanAcs),
        hsDelta: +(hsRate - bench.meanHs).toFixed(1),
        wrDelta: Math.round(winRate - 50),
      } : { kdDelta: 0, acsDelta: 0, hsDelta: 0, wrDelta: 0 },
      eloBandPerformance: bands,
      encounteredOpponents: opponents,
    },
  };
}

export function parityLabel(p: BandPerformance["evaluation"], locale: "en" | "ja"): string {
  const ja = { far_above: "大幅に上回る", above_average: "上回る", average: "概ね同等", below_average: "下回る", far_below: "大幅に下回る" } as const;
  const en = { far_above: "far above", above_average: "above", average: "about even with", below_average: "below", far_below: "far below" } as const;
  return (locale === "ja" ? ja : en)[p];
}

function roleLabel(role: AgentRole): string {
  return { duelist: "Duelist", initiator: "Initiator", controller: "Controller", sentinel: "Sentinel" }[role];
}
