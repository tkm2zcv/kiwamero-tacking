import { getDict } from "@/lib/i18n/server";
import type { Summary } from "@/lib/types";

export async function StatsGrid({ summary }: { summary: Summary }) {
  const t = await getDict();
  const stats = [
    { name: t.stats.winRate, value: `${summary.winRate.toFixed(1)}%`, sub: `${summary.wins}W / ${summary.losses}L`, accent: true },
    { name: t.stats.kdRatio, value: summary.kd.toFixed(2), sub: `${summary.kills.toFixed(1)} / ${summary.deaths.toFixed(1)} / ${summary.assists.toFixed(1)}` },
    { name: t.stats.acs, value: String(Math.round(summary.acs)) },
    { name: t.stats.damagePerRound, value: String(Math.round(summary.adr)) },
    { name: t.stats.headshot, value: `${Math.round(summary.hs)}%` },
    { name: t.stats.matches, value: String(summary.totalMatches || summary.matches) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {stats.map((s) => (
        <div key={s.name} className="trn-card px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-tertiary">{s.name}</div>
          <div className="mt-1 text-2xl font-black" style={s.accent ? { color: "var(--color-action)" } : undefined}>
            {s.value}
          </div>
          {s.sub ? <div className="text-xs text-secondary">{s.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}
