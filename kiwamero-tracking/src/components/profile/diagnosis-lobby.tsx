import Image from "next/image";
import type { AccountReport, BandPerformance } from "@/lib/report-model";
import type { Locale } from "@/lib/i18n/dict";
import { tierIcon, tierName } from "@/lib/henrik-shared";
import { parityLabel } from "@/lib/lobby-analysis";
import { ReportCard, ReportMeter, reportNumber as n, reportText } from "./report-ui";

const signed = (value: number, digits = 2) => `${value > 0 ? "+" : ""}${n(value, digits)}`;
const bandLabel = (band: string, locale: Locale) => locale === "ja" ? `${band}帯` : `${band} band`;

function markerTone(value: number, mean: number, upper: number): string {
  return value >= upper ? "danger" : value >= mean ? "good" : "neutral";
}

function metricJudgment(value: number, upper: number | null, z: number, locale: Locale): string {
  const L = reportText(locale);
  if (upper !== null && value >= upper) return L("仮定上限超過", "Above upper marker");
  if (z >= 1) return L("高め", "Above model");
  if (z <= -1) return L("低め", "Below model");
  return L("通常範囲", "Within model");
}

export function DiagnosisLobby({ report, locale }: { report: AccountReport; locale: Locale }) {
  const L = reportText(locale);
  const { benchmarksComparison: bc, lobbyAnalysis: lobby } = report.verdict;
  const opp = lobby.encounteredOpponents;
  const metrics = bc ? [
    ["HS%", bc.playerStats.hs, bc.expectedStats.hsMean, bc.expectedStats.hsP95, bc.zScores.hsZ, 1],
    ["K/D", bc.playerStats.kd, bc.expectedStats.kdMean, bc.expectedStats.kdP95, bc.zScores.kdZ, 2],
    ["ACS", bc.playerStats.acs, bc.expectedStats.acsMean, bc.expectedStats.acsP95, bc.zScores.acsZ, 0],
    [L("勝率", "Win rate"), bc.playerStats.winRate, 50, null, bc.zScores.wrZ, 1],
  ] as const : [];
  const bandRows = lobby.eloBandPerformance.map((band: BandPerformance) => ({
    ...band,
    label: bandLabel(band.bandName, locale),
    parity: parityLabel(band.evaluation, locale),
  }));
  return (
    <>
      <ReportCard title={L("対戦ロビー帯別パフォーマンス", "Performance by lobby band")}
        description={lobby.sampledMatches ? `${L("平均ロビー", "Average lobby")}: ${lobby.avgLobbyTierName}` : undefined}>
        {lobby.sampledMatches ? (
          <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("ロビー帯別の表", "Lobby band table")}>
            <table className="kt-report-table">
              <thead><tr>
                <th>{L("ロビー帯", "Lobby band")}</th><th>{L("試合 / W-L-D", "Matches / W-L-D")}</th>
                <th className="kt-report-num">K/D ({L("仮定平均", "model mean")})</th>
                <th className="kt-report-num">ACS ({L("仮定平均", "model mean")})</th>
                <th className="kt-report-num">HS%</th>
                <th className="kt-report-num">{L("モデル偏差", "Deviation")}</th>
                <th>{L("相対判定", "Relative result")}</th>
              </tr></thead>
              <tbody>{bandRows.map((b) => (
                <tr key={b.bandName}>
                  <th scope="row"><span className="kt-report-rank-cell"><Image src={tierIcon(b.minTier)} alt="" width={24} height={24} unoptimized />{b.label}</span></th>
                  <td>{b.matchesCount}<small>{b.wins}W / {b.losses}L / {b.draws}D · {b.wins + b.losses ? `${n(b.winRate, 1)}%` : "-"}</small></td>
                  <td className="kt-report-num"><strong data-tone={markerTone(b.kd, b.benchmark.meanKd, b.benchmark.p95Kd)}>{n(b.kd, 2)}</strong><small>({n(b.benchmark.meanKd, 2)})</small></td>
                  <td className="kt-report-num"><strong data-tone={markerTone(b.acs, b.benchmark.meanAcs, b.benchmark.p95Acs)}>{n(b.acs)}</strong><small>({n(b.benchmark.meanAcs)})</small></td>
                  <td className="kt-report-num"><strong data-tone={markerTone(b.hsRate, b.benchmark.meanHs, b.benchmark.p95Hs)}>{n(b.hsRate, 1)}%</strong></td>
                  <td className="kt-report-num"><strong data-tone={b.zScores.compositeZ >= 1.5 ? "danger" : b.zScores.compositeZ >= 0.5 ? "violet" : "neutral"}>{signed(b.zScores.compositeZ)}σ</strong></td>
                  <td><span className="v3-chip">{b.parity}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="kt-report-empty">{L("有効なロスターがありません。", "No valid roster sample.")}</p>}
        <p className="kt-report-footnote">{L("仮定平均・仮定上限は独自モデルの基準値です。実測母集団のP95ではありません。", "Model means and upper markers are heuristic constants, not observed population percentiles.")}</p>
      </ReportCard>
      {opp.totalOpponents ? (
        <ReportCard title={L(`対戦相手のランク分布（${n(opp.totalOpponents)}名）`, `Opponent rank distribution (${n(opp.totalOpponents)} players)`)}
          description={L("自己参照を除いた対戦相手PUUIDごとの標本内最新ランク", "Latest recorded rank per opponent PUUID, excluding the owner")}>
          <div className="kt-report-dist-grid">
            {[
              [L("最低対戦相手", "Lowest opponent"), opp.minTierName],
              [L("平均対戦相手", "Average opponent"), opp.avgTierName],
              [L("中央値", "Median"), tierName(Math.round(opp.medianTier))],
              [L("最高対戦相手", "Highest opponent"), opp.maxTierName],
            ].map(([label, value]) => <div key={label}><small>{label}</small><strong>{value}</strong></div>)}
          </div>
          <div className="kt-report-dist">
            {opp.tierDistribution.map((row) => (
              <div className="kt-report-dist-row" key={row.tier}>
                <div><Image src={tierIcon(row.tier)} alt="" width={20} height={20} unoptimized /><strong>{row.tierName}</strong></div>
                <ReportMeter value={row.percentage} label={row.tierName} tone="sky" />
                <span>{n(row.count)} {L("名", "players")} ({n(row.percentage, 1)}%)</span>
              </div>
            ))}
          </div>
        </ReportCard>
      ) : null}
      <ReportCard title={L("モデル基準との直接照合", "Direct model comparison")}
        description={bc ? L("同じ標本内のランク・主ロールに対する比較。基準値は独自の仮定です。", "Same-sample rank and role. Baselines are heuristic assumptions.") : undefined}>
        {bc ? (
          <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("モデル比較表", "Model comparison table")}>
            <table className="kt-report-table">
              <thead><tr>
                <th>{L("戦闘指標", "Metric")}</th><th className="kt-report-num">{L("本人実測値", "Observed")}</th>
                <th className="kt-report-num">{L("仮定平均", "Model mean")}</th>
                <th className="kt-report-num">{L("仮定上限", "Upper marker")}</th>
                <th className="kt-report-num">{L("モデル偏差", "Deviation")}</th>
                <th>{L("相対判定", "Relative result")}</th>
              </tr></thead>
              <tbody>{metrics.map(([label, value, mean, upper, z, digits]) => (
                <tr key={label}><th scope="row">{label}</th>
                  <td className="kt-report-num"><strong>{n(value, digits)}{label === "HS%" || label === L("勝率", "Win rate") ? "%" : ""}</strong></td>
                  <td className="kt-report-num">{n(mean, digits)}</td>
                  <td className="kt-report-num">{upper === null ? "-" : n(upper, digits)}</td>
                  <td className="kt-report-num"><strong data-tone={z >= 2 ? "danger" : z >= 1 ? "violet" : "neutral"}>{signed(z)}σ</strong></td>
                  <td><span className="v3-chip">{metricJudgment(value, upper, z, locale)}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="kt-report-empty">{L("標本不足のため比較結果を保留しています。", "Comparison withheld because the sample is insufficient.")}</p>}
        <p className="kt-report-footnote">{L("仮定上限は実測のP95ではありません。勝率の分母は決着試合のみです。", "The upper marker is not an observed P95. Win rate uses decided matches only.")}</p>
      </ReportCard>
    </>
  );
}
