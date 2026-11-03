import { normalizeCluster } from "./henrik-shared.ts";
import type { StoredRow } from "./stored-stats";
import type { AuditChangePoint } from "./audit-timeline";

export interface AuditOriginShift {
  from: string; to: string;
  earlyFrom: number; earlyTo: number; recentFrom: number; recentTo: number;
  earlyMatches: number; recentMatches: number; gapDays: number; points: number;
}

function dominant(rows: StoredRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeCluster(row.cluster.trim()).trim();
    if (key && !/^(unknown|n\/a|none|null|unavailable|-)$/i.test(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0];
  return top && top[1] >= rows.length * 0.8 ? top : null;
}

/** Input is the deduplicated, chronological Competitive history, not account creation data. */
export function auditOriginShift(rows: StoredRow[]): AuditOriginShift | null {
  if (rows.length < 60) return null;
  const early = rows.slice(0, 20), recent = rows.slice(-40);
  const from = dominant(early), first = dominant(recent.slice(0, 20)), last = dominant(recent.slice(20));
  if (!from || !first || !last || first[0] !== last[0] || from[0] === last[0] ||
    recent[0].startedAt <= early.at(-1)!.startedAt ||
    recent.at(-1)!.startedAt - recent[0].startedAt < 7 * 86400) return null;
  const gapDays = rows.slice(1).reduce((gap, row, i) =>
    Math.max(gap, (row.startedAt - rows[i].startedAt) / 86400), 0);
  return {
    from: from[0], to: last[0], earlyFrom: early[0].startedAt, earlyTo: early.at(-1)!.startedAt,
    recentFrom: recent[0].startedAt, recentTo: recent.at(-1)!.startedAt,
    earlyMatches: from[1], recentMatches: first[1] + last[1], gapDays,
    points: gapDays >= 30 ? 15 : 30,
  };
}

/** A lifetime endpoint difference must not boost an unrelated K/D event. */
export function originSupportsBoundary(origin: AuditOriginShift, boundary: AuditChangePoint, rows: StoredRow[]) {
  if (!boundary.server.changed || boundary.server.before !== origin.from || boundary.server.after !== origin.to) return false;
  const after = rows.filter((r) => r.startedAt >= boundary.at);
  return after.length >= 40 && after.filter((r) => normalizeCluster(r.cluster.trim()).trim() === origin.to).length >= after.length * 0.8;
}
