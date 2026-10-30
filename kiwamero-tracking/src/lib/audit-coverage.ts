/** Browser-safe progress contract; calculating coverage never reads or updates storage. */
export interface AuditCoverage {
  total: number; cached: number; pending: number; unavailable: number;
  syncedAt: number; nextAttemptAt: number | null; state: "idle" | "pending" | "complete" | "partial";
  periods: AuditCoveragePeriod[];
}

export interface AuditCoveragePeriod {
  period: string; from: number; to: number; total: number;
  cached: number; unavailable: number; next: number | null;
}

export interface AuditHistorySummary { expected: number; syncedAt: number }

export function summarizeAuditCoverage(
  periods: AuditCoveragePeriod[], history?: AuditHistorySummary,
): AuditCoverage {
  const total = Math.max(periods.reduce((s, p) => s + p.total, 0), history?.expected ?? 0);
  const cached = periods.reduce((s, p) => s + p.cached, 0);
  const unavailable = periods.reduce((s, p) => s + p.unavailable, 0);
  const next = periods.flatMap((p) => p.next === null ? [] : [p.next]);
  const pending = total - cached - unavailable;
  return { total, cached, pending, unavailable, syncedAt: history?.syncedAt ?? 0,
    nextAttemptAt: next.length ? Math.min(...next) : null, periods,
    state: !history ? "idle" : pending ? "pending" : unavailable ? "partial" : "complete" };
}
