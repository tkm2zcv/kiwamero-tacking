/**
 * Per-rank-band expected performance benchmarks for the account report.
 *
 * Assumed comparison constants, NOT measured population statistics.
 * The legacy p95* field names denote upper model markers, not observed
 * percentiles. Never derive calibrated probabilities or significance from them.
 */

import { agentRole as knownAgentRole, type RoleKey } from "./profile-stats.ts";

export type AgentRole = RoleKey | "unknown";

export interface BandBenchmark {
  band: string;
  minTier: number;
  maxTier: number;
  meanKd: number;
  p95Kd: number;
  meanAcs: number;
  p95Acs: number;
  meanHs: number;
  p95Hs: number;
}

/** Band centers sit between min and max tier ids (Iron 3-5 … Radiant 27). */
const BANDS: BandBenchmark[] = [
  { band: "Iron",      minTier: 3,  maxTier: 5,  meanKd: 0.92, p95Kd: 1.95, meanAcs: 178,   p95Acs: 315,   meanHs: 16.5,  p95Hs: 36.5 },
  { band: "Bronze",    minTier: 6,  maxTier: 8,  meanKd: 0.95, p95Kd: 1.95, meanAcs: 185,   p95Acs: 318,   meanHs: 18.5,  p95Hs: 38.5 },
  { band: "Silver",    minTier: 9,  maxTier: 11, meanKd: 0.98, p95Kd: 1.95, meanAcs: 192,   p95Acs: 320,   meanHs: 21.0,  p95Hs: 40.5 },
  { band: "Gold",      minTier: 12, maxTier: 14, meanKd: 1.02, p95Kd: 1.95, meanAcs: 200,   p95Acs: 322,   meanHs: 23.5,  p95Hs: 42.5 },
  { band: "Platinum",  minTier: 15, maxTier: 17, meanKd: 1.05, p95Kd: 1.95, meanAcs: 206,   p95Acs: 325,   meanHs: 25.5,  p95Hs: 44.5 },
  { band: "Diamond",   minTier: 18, maxTier: 20, meanKd: 1.08, p95Kd: 1.95, meanAcs: 210,   p95Acs: 328,   meanHs: 27.5,  p95Hs: 45.5 },
  { band: "Ascendant", minTier: 21, maxTier: 23, meanKd: 1.10, p95Kd: 2.0,  meanAcs: 212,   p95Acs: 330,   meanHs: 29.0,  p95Hs: 46.4 },
  { band: "Immortal",  minTier: 24, maxTier: 26, meanKd: 1.10, p95Kd: 2.0,  meanAcs: 212.5, p95Acs: 332,   meanHs: 30.11, p95Hs: 47.53 },
  { band: "Radiant",   minTier: 27, maxTier: 27, meanKd: 1.20, p95Kd: 2.0,  meanAcs: 225,   p95Acs: 329.85, meanHs: 30.30, p95Hs: 47.77 },
];

/** Shift applied to the Duelist baseline for less frag-focused roles. */
const ROLE_OFFSET: Record<AgentRole, { kd: number; acs: number; hs: number }> = {
  duelist:    { kd: 0,    acs: 0,   hs: 0 },
  initiator:  { kd: -0.06, acs: -30, hs: -3.0 },
  controller: { kd: -0.04, acs: -22, hs: -2.5 },
  sentinel:   { kd: -0.03, acs: -18, hs: -2.0 },
  unknown:    { kd: 0, acs: 0, hs: 0 },
};

export function agentRole(agent: string): AgentRole {
  return knownAgentRole(agent) ?? "unknown";
}

/** Dominant role across a [(agent, count)] distribution. */
export function dominantRole(topAgents: [string, number][]): AgentRole {
  const acc = new Map<AgentRole, number>();
  for (const [agent, n] of topAgents) {
    const r = agentRole(agent);
    acc.set(r, (acc.get(r) ?? 0) + n);
  }
  return [...acc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
}

export function bandForTier(tier: number): BandBenchmark {
  const t = Math.max(3, Math.min(27, Math.round(tier)));
  return BANDS.find((b) => t >= b.minTier && t <= b.maxTier) ?? BANDS[BANDS.length - 1];
}

export function bandCenter(band: BandBenchmark): number {
  return (band.minTier + band.maxTier) / 2;
}

/** Benchmark for `tier` adjusted to the player's dominant role. */
export function benchmarkFor(tier: number, role: AgentRole): BandBenchmark {
  const b = bandForTier(tier);
  const off = ROLE_OFFSET[role];
  if (role === "duelist") return b;
  return {
    ...b,
    meanKd: +(b.meanKd + off.kd).toFixed(3),
    p95Kd: +(b.p95Kd + off.kd).toFixed(3),
    meanAcs: +(b.meanAcs + off.acs).toFixed(1),
    p95Acs: +(b.p95Acs + off.acs).toFixed(1),
    meanHs: +(b.meanHs + off.hs).toFixed(2),
    p95Hs: +(b.p95Hs + off.hs).toFixed(2),
  };
}

/**
 * Model scale from an assumed upper marker. The 1.645 factor is a legacy
 * normalization constant, NOT evidence of a normal population or an observed SD.
 */
export function metricSigma(mean: number, p95: number, floor: number): number {
  return Math.max((p95 - mean) / 1.645, floor);
}
