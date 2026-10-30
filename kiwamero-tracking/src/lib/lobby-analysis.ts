/**
 * Lobby analysis for the smurf diagnosis: bucket sampled full-roster matches
 * by average lobby tier and compare with assumed per-band model constants.
 * The reference rank/spread is heuristic, not a likelihood or confidence bound.
 */
import {
  bandCenter, bandForTier, benchmarkFor, dominantRole, metricSigma,
  type AgentRole, type BandBenchmark,
} from "./rank-benchmarks.ts";
import { tierName } from "./henrik-shared.ts";
import type { BandPerformance, LobbyAnalysis, OpponentTiers } from "./report-model";
import type { Match } from "./types";

/** Approx. z-score produced by one full tier of skill gap in a lobby. */
const Z_PER_TIER = 0.3;
/** Minimum heuristic model spread, in tier divisions. */
const MIN_MODEL_SPREAD = 2;

interface MatchSample {
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
    const wins = list.filter((s) => s.result === "win").length;
    const losses = list.filter((s) => s.result === "loss").length;
    const draws = n - wins - losses;
    const kills = list.reduce((s, m) => s + m.kills, 0);
    const deaths = list.reduce((s, m) => s + m.deaths, 0);
    const score = list.reduce((s, m) => s + m.score, 0);
    const rounds = list.reduce((s, m) => s + m.rounds, 0);
    const head = list.reduce((s, m) => s + m.head, 0);
    const shots = list.reduce((s, m) => s + m.shots, 0);
    const kd = deaths ? kills / deaths : kills;
    const acs = rounds ? score / rounds : 0;
    const hsRate = shots ? (head / shots) * 100 : 0;
    const winRate = wins + losses ? (wins / (wins + losses)) * 100 : 0;
    const bench = benchmarkFor(bandCenter(band), role);
    const kdZ = (kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2);
    const acsZ = (acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25);
    const hsZ = (hsRate - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4);
    // Binomial σ around a 50% lobby win rate shrinks as the sample grows.
    // Effect size, not significance: does not grow unbounded with sample size.
    const wrZ = wins + losses ? (winRate - 50) / 25 : 0;
    const compositeZ = (kdZ + acsZ + hsZ + wrZ) / 4;
    return {
      bandName: band.band, minTier: band.minTier, maxTier: band.maxTier,
      matchesCount: n, wins, losses, draws, winRate: +winRate.toFixed(1),
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
  sampledMatchIds: string[];
  analysis: LobbyAnalysis;
  bands: BandPerformance[];
  role: AgentRole;
  /** Sample-weighted reference tier and heuristic spread, NOT an SD. */
  estimate: { tier: number; sigma: number };
}

export function analyzeLobby(
  matches: Match[],
  selfKey: string,
  topAgents: [string, number][],
  locale: "en" | "ja",
): LobbyResult {
  const samples = sampleMatches(matches, selfKey);
  const role = dominantRole(samples.length ? samples.map((s) => [s.agent, 1]) : topAgents);
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
  const wins = samples.filter((s) => s.result === "win").length;
  const decided = samples.filter((s) => s.result !== "draw").length;
  const winRate = decided ? wins / decided * 100 : 0;

  const bench = benchmarkFor(avgLobby || 12, role); // no samples → neutral Gold anchor
  const kdZ = n ? (kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2) : 0;
  const acsZ = n ? (acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25) : 0;
  const hsZ = n ? (hsRate - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4) : 0;
  const wrZ = decided ? (winRate - 50) / 25 : 0;
  const compositeZ = n ? (kdZ + acsZ + hsZ + wrZ) / 4 : 0;

  // Sample-weighted model: each 0.3 deviation shifts one tier from the actual
  // lobby average. Do not use a band's midpoint (it biases edge-of-band lobbies).
  let estTier = avgLobby;
  let estSigma = MIN_MODEL_SPREAD;
  const weighted = bands.filter((b) => b.matchesCount > 0);
  if (weighted.length && avgLobby > 0) {
    let num = 0, den = 0;
    for (const b of weighted) {
      const inBand = samples.filter((s) => bandForTier(s.lobbyTier).band === b.bandName);
      const center = inBand.reduce((sum, s) => sum + s.lobbyTier, 0) / inBand.length;
      const tHat = center + Math.max(-1.5, Math.min(1.5, b.zScores.compositeZ)) / Z_PER_TIER;
      const w = b.matchesCount;
      num += tHat * w; den += w;
    }
    estTier = num / den;
    estSigma = MIN_MODEL_SPREAD + 3 / Math.sqrt(n);
  }

  const parity = evaluation(compositeZ);
  const lo = samples.length ? Math.min(...samples.map((s) => s.lobbyTier)) : 0;
  const hi = samples.length ? Math.max(...samples.map((s) => s.lobbyTier)) : 0;
  const name = (t: number) => (t > 0 ? `${tierName(Math.round(t))} (Tier ${t.toFixed(1)})` : "—");
  const estName = tierName(Math.round(Math.min(27, Math.max(3, estTier)))) || "—";
  const performanceDescription = !n ? "" : locale === "ja"
    ? `${tierName(Math.round(avgLobby))}帯・${roleLabel(role)}の仮定モデル基準を${parityLabel(parity, "ja")}。参考ランクは${estName}。実測母集団による推定ではありません。`
    : `Performance is ${parityLabel(parity, "en")} the assumed ${tierName(Math.round(avgLobby))} ${role} model. Reference rank: ${estName}. Not calibrated against a player population.`;

  return {
    bands, role, estimate: { tier: estTier, sigma: estSigma },
    sampledMatchIds: samples.map((s) => s.matchId),
    analysis: {
      sampledMatches: n,
      referenceTier: n ? Math.round(samples.reduce((sum, s) => sum + s.selfTier, 0) / n) : 0,
      stats: {
        count: n, kd, acs, hsRate, accuracyCount: n, winRate, topAgents: samples.map((s) => [s.agent, 1]),
        meanTier: n ? samples.reduce((sum, s) => sum + s.selfTier, 0) / n : 0,
      },
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
  return { duelist: "Duelist", initiator: "Initiator", controller: "Controller", sentinel: "Sentinel", unknown: "Unknown" }[role];
}
