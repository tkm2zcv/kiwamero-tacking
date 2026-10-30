import type { AccountReport, BandPerformance } from "@/lib/report-model";
import { parityLabel } from "@/lib/lobby-analysis";

const Z_COLOR = (z: number) => (z > 2 ? "#f87171" : z > 0.75 ? "#fbbf24" : z < -0.75 ? "#38bdf8" : "inherit");
const PARITY_COLOR: Record<BandPerformance["evaluation"], string> = {
  far_above: "#f87171", above_average: "#fbbf24", average: "#34d399",
  below_average: "#38bdf8", far_below: "#a78bfa",
};

/** Benchmark comparison + lobby analysis + opponent tier distribution. */
export function DiagnosisLobby({ report, locale }: { report: AccountReport; locale: "en" | "ja" }) {
  const v = report.verdict;
  const bc = v.benchmarksComparison;
  const lobby = v.lobbyAnalysis;
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);
  const roleLabel = bc.role.charAt(0).toUpperCase() + bc.role.slice(1);
  const metrics: [string, number, number, number, number][] = [
    ["K/D", bc.playerStats.kd, bc.expectedStats.kdMean, bc.expectedStats.kdP95, bc.zScores.kdZ],
    ["ACS", bc.playerStats.acs, bc.expectedStats.acsMean, bc.expectedStats.acsP95, bc.zScores.acsZ],
    ["HS%", bc.playerStats.hs, bc.expectedStats.hsMean, bc.expectedStats.hsP95, bc.zScores.hsZ],
    [L("勝率", "Win rate"), bc.playerStats.winRate, 50, 80, bc.zScores.combatZ],
  ];
  const opp = lobby.encounteredOpponents;

  return (
    <>
      <div className="v3-card">
        <header className="v3-card__header">
          <h2 className="v3-card__title">{L("ランクベンチマーク比較", "Rank benchmark comparison")}</h2>
        </header>
        <div className="v3-card__body v3-card__body--v2.5">
          <p className="px-4 pt-3 text-11 text-tertiary">
            {L(`${bc.currentRankName}・${roleLabel} 基準の平均 / p95 に対する偏差（z値）`,
              `Deviation (z) vs ${bc.currentRankName} ${roleLabel} mean / p95 markers`)}
          </p>
          <div className="grid gap-y-px overflow-hidden rounded-4">
            <div className="row relative flex min-h-9 items-center bg-[--row-color] px-4 text-11 font-bold uppercase tracking-wider text-tertiary">
              <span className="w-24" /><span className="w-20">{L("実測", "You")}</span>
              <span className="w-20">{L("平均", "Mean")}</span><span className="w-20">P95</span>
              <span className="flex-1 text-right">z</span>
            </div>
            {metrics.map(([label, val, mean, p95, z]) => (
              <div key={label} className="row relative flex min-h-11 items-center bg-[--row-color] px-4 text-13">
                <span className="w-24 text-secondary">{label}</span>
                <span className="w-20 font-bold">{val}</span>
                <span className="w-20 text-secondary">{mean}</span>
                <span className="w-20 text-secondary">{p95}</span>
                <span className="flex-1 text-right font-bold" style={{ color: Z_COLOR(z) }}>{z.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{L("ロビー分析", "Lobby analysis")}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 p-4">
          {lobby.sampledMatches ? (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-13">
                <span>{`${L("平均ロビー", "Avg lobby")}: `}<b>{lobby.avgLobbyTierName}</b></span>
                <span className="text-secondary">{lobby.tierSpan}</span>
                <span className="rounded-2 px-2 py-0.5 text-12 font-bold"
                  style={{ color: PARITY_COLOR[lobby.combatParity], background: `${PARITY_COLOR[lobby.combatParity]}22` }}>
                  {parityLabel(lobby.combatParity, locale)}
                </span>
              </div>
              <p className="mt-2 text-12 text-secondary">{lobby.performanceDescription}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-12 text-secondary">
                <span>K/D {signed(lobby.relativeStats.kdDelta)}</span>
                <span>ACS {signed(lobby.relativeStats.acsDelta)}</span>
                <span>HS% {signed(lobby.relativeStats.hsDelta)}</span>
                <span>{L("勝率", "WR")} {signed(lobby.relativeStats.wrDelta)}%</span>
              </div>
            </>
          ) : (
            <p className="text-13 text-secondary">
              {L("コンペティティブのロスター標本がありません。", "No competitive roster sample available.")}
            </p>
          )}
        </div>
      </div>

      {lobby.eloBandPerformance.length ? (
        <div className="v3-card">
          <header className="v3-card__header"><h2 className="v3-card__title">{L("帯別パフォーマンス", "Performance by lobby band")}</h2></header>
          <div className="v3-card__body v3-card__body--v2.5 grid gap-y-px overflow-hidden rounded-4">
            <div className="row relative flex min-h-9 items-center bg-[--row-color] px-4 text-11 font-bold uppercase tracking-wider text-tertiary">
              <span className="w-24">{L("帯", "Band")}</span><span className="w-14">{L("試合", "M")}</span>
              <span className="w-16">{L("勝率", "WR")}</span><span className="w-14">K/D</span>
              <span className="w-14">ACS</span><span className="w-16">HS%</span>
              <span className="flex-1 text-right">z</span>
            </div>
            {lobby.eloBandPerformance.map((b) => (
              <div key={b.bandName} className="row relative flex min-h-11 items-center bg-[--row-color] px-4 text-13">
                <span className="w-24">{b.bandName}</span>
                <span className="w-14 text-secondary">{b.matchesCount}</span>
                <span className="w-16">{b.winRate}%</span>
                <span className="w-14">{b.kd}</span>
                <span className="w-14">{b.acs}</span>
                <span className="w-16">{b.hsRate}%</span>
                <span className="flex-1 text-right font-bold" style={{ color: Z_COLOR(b.zScores.compositeZ) }}>
                  {b.zScores.compositeZ.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {opp.totalOpponents ? (
        <div className="v3-card">
          <header className="v3-card__header"><h2 className="v3-card__title">{L("対戦相手のランク分布", "Opponent rank distribution")}</h2></header>
          <div className="v3-card__body v3-card__body--v2.5 p-4">
            <div className="mb-3 text-12 text-secondary">
              {opp.totalOpponents} {L("人の敵", "opponents")} · {L("平均", "avg")} {opp.avgTierName} · {opp.minTierName} 〜 {opp.maxTierName}
            </div>
            <div className="flex h-4 w-full overflow-hidden rounded-full bg-white/8">
              {opp.tierDistribution.map((d) => (
                <div key={d.tier} title={`${d.tierName}: ${d.count}`}
                  style={{ width: `${d.percentage}%`, background: bandColor(d.tier) }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-11 text-secondary">
              {opp.tierDistribution.map((d) => (
                <span key={d.tier} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: bandColor(d.tier) }} />
                  {d.tierName} {d.percentage}%
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

const signed = (v: number) => (v > 0 ? `+${v}` : `${v}`);

function bandColor(tier: number): string {
  if (tier >= 27) return "#fbbf24";       // radiant gold
  if (tier >= 24) return "#a78bfa";       // immortal violet
  if (tier >= 21) return "#fb7185";       // ascendant pink
  if (tier >= 18) return "#c084fc";       // diamond purple
  if (tier >= 15) return "#38bdf8";       // platinum cyan
  if (tier >= 12) return "#facc15";       // gold
  if (tier >= 9) return "#e5e7eb";        // silver
  if (tier >= 6) return "#d6a17a";        // bronze
  return "#9ca3af";                        // iron
}
