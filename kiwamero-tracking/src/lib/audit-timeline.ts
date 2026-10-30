import { buildGenealogy, earlyRecentComparison } from "./report-evidence.ts";
import type { EarlyRecentComparison } from "./report-model";
import type { StoredRow } from "./stored-stats";
import type { Match } from "./types";

export interface AuditChangePoint {
  at: number; from: number; to: number; strength: number;
  comparison: EarlyRecentComparison;
  server: { before: string; after: string; changed: boolean };
  agentChanged: boolean; hoursChanged: boolean;
  rosterBefore: number; rosterAfter: number;
  partyOverlap: number | null;
  matchIds: string[];
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

/** Adjacent windows at every boundary, not just the oldest/newest halves. */
export function auditTimeline(rows: StoredRow[], rosters: Match[] = [], puuid = ""): AuditTimeline {
  const size = 20;
  let comparableWindows = 0;
  const possible: AuditChangePoint[] = [];
  for (let i = size; i <= rows.length - size; i++) {
    const before = rows.slice(i - size, i), after = rows.slice(i, i + size);
    const comparison = earlyRecentComparison([...before, ...after]);
    if (!comparison.comparable) continue;
    comparableWindows++;
    const c = comparison;
    const strength = [Math.abs(c.kdDiff) / 0.4, Math.abs(c.acsDiff) / 60, Math.abs(c.hsDiff) / 8];
    if (strength.filter((n) => n >= 1).length < 2) continue;
    const gen = buildGenealogy([...before, ...after], { name: "", tag: "" });
    const hb = hours(before), ha = hours(after);
    possible.push({
      at: after[0].startedAt, from: before[0].startedAt, to: after[size - 1].startedAt,
      comparison, strength: strength.reduce((sum, n) => sum + Math.min(3, n), 0),
      server: { before: gen.earliestCluster, after: gen.recentCluster, changed: gen.hasClusterFlip },
      agentChanged: !c.before.topAgents.some(([a]) => c.after.topAgents.some(([b]) => a === b)),
      hoursChanged: hb.reduce((sum, n, j) => sum + Math.abs(n - ha[j]), 0) / 2 >= 0.6,
      rosterBefore: 0, rosterAfter: 0, partyOverlap: null,
      matchIds: [...before, ...after].map((r) => r.id),
    });
  }
  const selected: AuditChangePoint[] = [];
  const positions = new Map(rows.map((r, i) => [r.startedAt, i]));
  for (const c of possible.sort((a, b) => b.strength - a.strength || a.at - b.at)) {
    if (selected.some((p) => Math.abs((positions.get(p.at) ?? 0) - (positions.get(c.at) ?? 0)) < size)) continue;
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
