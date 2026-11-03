import { buildGenealogy, earlyRecentComparison } from "./report-evidence.ts";
import type { EarlyRecentComparison } from "./report-model";
import type { StoredRow } from "./stored-stats";
import type { Match } from "./types";
import { agentRole } from "./rank-benchmarks.ts";

export interface AuditChangePoint {
  at: number; from: number; to: number; strength: number;
  comparison: EarlyRecentComparison;
  server: { before: string; after: string; changed: boolean };
  agentChanged: boolean; hoursChanged: boolean;
  rosterBefore: number; rosterAfter: number;
  partyOverlap: number | null;
  matchIds: string[];
  kind: "performance" | "server";
  persistentLowKd: boolean;
  roleChanged: boolean;
  gapDays: number;
}
export interface AuditTimeline {
  windowSize: number; windowsScanned: number; comparableWindows: number;
  candidates: AuditChangePoint[];
}

export function validAuditRows(rows: StoredRow[], now = Date.now() / 1000) {
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (typeof r.mode !== "string" || r.mode.toLowerCase() !== "competitive" ||
      typeof r.id !== "string" || !r.id || seen.has(r.id) || r.statsAvailable === false ||
      !Number.isFinite(r.startedAt) || r.startedAt <= 0 || r.startedAt > now ||
      ![r.rounds, r.kills, r.deaths, r.score, r.head, r.body, r.leg]
        .every((n) => Number.isFinite(n) && n >= 0) || r.rounds < 5) return false;
    seen.add(r.id);
    return true;
  }).sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id));
}

function hours(rows: StoredRow[]) {
  const bins = [0, 0, 0, 0, 0, 0];
  for (const r of rows) bins[Math.floor(new Date(r.startedAt * 1000).getUTCHours() / 4)] += 1 / rows.length;
  return bins;
}

function rankCoverage(rows: StoredRow[]) {
  const tiers = rows.filter((r) => Number.isInteger(r.tier) && r.tier >= 3 && r.tier <= 27)
    .map((r) => r.tier);
  return tiers.length >= rows.length * 0.8 && Math.max(...tiers) - Math.min(...tiers) <= 4;
}

function kd(rows: StoredRow[]) {
  const deaths = rows.reduce((sum, r) => sum + r.deaths, 0);
  return deaths ? rows.reduce((sum, r) => sum + r.kills, 0) / deaths : null;
}

function kdChange(before: StoredRow[], after: StoredRow[]) {
  const c = earlyRecentComparison([...before, ...after]);
  const oldKd = kd(before), newKd = kd(after);
  c.comparable = oldKd !== null && newKd !== null && rankCoverage(before) && rankCoverage(after) &&
    c.after.meanTier <= c.before.meanTier + 2;
  const halves = [before.slice(0, 10), before.slice(10), after.slice(0, 10), after.slice(10)].map(kd);
  let changed = false, low = false;
  if (c.comparable && halves.every((value) => value !== null)) {
    const [b1, b2, a1, a2] = halves as number[];
    const delta = newKd! - oldKd!, direction = Math.sign(delta);
    const drift = Math.max(Math.abs(b2 - b1), Math.abs(a2 - a1), 0.05);
    const persistent = after.filter((r) => r.deaths > 0 &&
      direction * (r.kills / r.deaths - oldKd!) >= 0.2).length >= 14 &&
      before.filter((r) => r.deaths > 0 && direction * (newKd! - r.kills / r.deaths) >= 0.2).length >= 14;
    // A step must dominate within-window trends; a linear ramp is not a boundary.
    changed = Math.abs(delta) >= 0.4 && Math.abs(delta) > 2.5 * drift && persistent &&
      direction * (a1 - oldKd!) >= 0.3 && direction * (a2 - oldKd!) >= 0.3 &&
      (direction < 0 || Math.abs(c.after.meanTier - c.before.meanTier) <= 2);
    low = changed && oldKd! >= 0.9 && newKd! <= 0.8 && a1 <= 0.85 && a2 <= 0.85;
  }
  c.hasTransition = changed;
  return { comparison: c, changed, low };
}

/** Adjacent windows at every boundary, not just the oldest/newest halves. */
export function auditTimeline(rows: StoredRow[], rosters: Match[] = [], puuid = ""): AuditTimeline {
  const size = 20;
  let comparableWindows = 0;
  const possible: AuditChangePoint[] = [];
  for (let i = size; i <= rows.length - size; i++) {
    const before = rows.slice(i - size, i), after = rows.slice(i, i + size);
    if (after[0].startedAt <= before[size - 1].startedAt) continue;
    const { comparison, changed, low } = kdChange(before, after);
    if (comparison.comparable) comparableWindows++;
    const gen = buildGenealogy([...before, ...after], { name: "", tag: "" });
    if (!changed && !gen.hasClusterFlip) continue;
    const roles = [comparison.before, comparison.after].map((b) =>
      b.topAgents[0] ? agentRole(b.topAgents[0][0]) : "unknown");
    const hb = hours(before), ha = hours(after);
    possible.push({
      at: after[0].startedAt, from: before[0].startedAt, to: after[size - 1].startedAt,
      comparison, strength: (changed ? 10 : 0) + (low ? 10 : 0) +
        (changed ? Math.min(5, Math.abs(comparison.kdDiff)) : 0) + (gen.hasClusterFlip ? 1 : 0),
      server: { before: gen.earliestCluster, after: gen.recentCluster, changed: gen.hasClusterFlip },
      agentChanged: !comparison.before.topAgents.some(([a]) => comparison.after.topAgents.some(([b]) => a === b)),
      hoursChanged: hb.reduce((sum, n, j) => sum + Math.abs(n - ha[j]), 0) / 2 >= 0.6,
      rosterBefore: 0, rosterAfter: 0, partyOverlap: null,
      matchIds: [...before, ...after].map((r) => r.id),
      kind: changed ? "performance" : "server", persistentLowKd: low,
      roleChanged: roles.every((r) => r !== "unknown") && roles[0] !== roles[1],
      // Include nearby gaps so shifting a candidate a few matches cannot evade the penalty.
      gapDays: Math.max(...[...before, ...after].slice(1).map((r, j) =>
        (r.startedAt - [...before, ...after][j].startedAt) / 86400)),
    });
  }
  const selected: AuditChangePoint[] = [];
  const positions = new Map(rows.map((r, i) => [r.id, i]));
  for (const c of possible.sort((a, b) => b.strength - a.strength || a.at - b.at)) {
    if (selected.some((p) => Math.abs((positions.get(p.matchIds[size]) ?? 0) -
      (positions.get(c.matchIds[size]) ?? 0)) < size)) continue;
    selected.push(c);
    if (selected.length === 5) break;
  }
  for (const c of selected) {
    const partners = [new Map<string, number>(), new Map<string, number>()];
    const known = [0, 0];
    const byId = new Map(rosters.map((m) => [m.metadata.matchid, m]));
    c.matchIds.forEach((id, i) => {
      const m = byId.get(id), side = i < size ? 0 : 1;
      const self = m?.players.find((p) => p.puuid === puuid);
      if (!m || !self || m.players.length !== 10 ||
        new Set(m.players.map((p) => p.puuid)).size !== 10) return;
      if (side === 0) c.rosterBefore++; else c.rosterAfter++;
      if (!self.party_id || !self.team_id || m.players.some((p) => p.party_id === self.party_id &&
        p.team_id?.toLowerCase() !== self.team_id?.toLowerCase())) return;
      known[side]++;
      for (const p of m.players) if (p.puuid !== puuid && p.party_id === self.party_id &&
        p.team_id?.toLowerCase() === self.team_id.toLowerCase()) {
        partners[side].set(p.puuid, (partners[side].get(p.puuid) ?? 0) + 1);
      }
    });
    const sets = partners.map((p) => new Set([...p].filter(([, n]) => n >= 2).map(([id]) => id)));
    if (known.every((n) => n >= size * 0.8) && sets.every((s) => s.size >= 2)) {
      const union = new Set([...sets[0], ...sets[1]]);
      c.partyOverlap = [...sets[0]].filter((id) => sets[1].has(id)).length / union.size;
    }
  }
  return { windowSize: size, windowsScanned: Math.max(0, rows.length - 2 * size + 1),
    comparableWindows, candidates: selected };
}
