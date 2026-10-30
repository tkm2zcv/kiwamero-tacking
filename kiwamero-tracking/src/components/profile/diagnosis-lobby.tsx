import type { AccountReport } from "@/lib/report-model";
import type { Locale } from "@/lib/i18n/dict";
import { tierName } from "@/lib/henrik-shared";
import { ReportCard, ReportMeter, reportNumber as n, reportText } from "./report-ui";

export function DiagnosisLobby({ report, locale }: { report: AccountReport; locale: Locale }) {
  const L = reportText(locale);
  const { benchmarksComparison: bc, lobbyAnalysis: lobby } = report.verdict;
  const opp = lobby.encounteredOpponents;
  const metrics = bc ? [
    ["K/D", bc.playerStats.kd, bc.expectedStats.kdMean, bc.expectedStats.kdP95, bc.zScores.kdZ, 2],
    ["ACS", bc.playerStats.acs, bc.expectedStats.acsMean, bc.expectedStats.acsP95, bc.zScores.acsZ, 0],
    ["HS%", bc.playerStats.hs, bc.expectedStats.hsMean, bc.expectedStats.hsP95, bc.zScores.hsZ, 1],
    [L("勝率", "Win rate"), bc.playerStats.winRate, 50, null, bc.zScores.wrZ, 1],
  ] as const : [];
  return (
    <>
      <ReportCard title={L("モデル基準との比較", "Reference model comparison")}
        description={L("同じ標本内のランク・主ロールに対する比較。基準値は独自の仮定です。", "Same-sample rank and role. Baselines are heuristic assumptions.")}>
        {bc ? (
          <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("モデル比較表", "Model comparison table")}>
            <table className="kt-report-table">
              <thead><tr>
                <th>{L("指標", "Metric")}</th><th className="kt-report-num">{L("標本の成績", "Observed")}</th>
                <th className="kt-report-num">{L("仮定平均", "Model mean")}</th>
                <th className="kt-report-num">{L("仮定上限", "Upper marker")}</th>
                <th className="kt-report-num">{L("モデル偏差", "Deviation")}</th>
              </tr></thead>
              <tbody>{metrics.map(([label, value, mean, upper, z, digits]) => (
                <tr key={label}><th scope="row">{label}</th>
                  <td className="kt-report-num"><strong>{n(value, digits)}</strong></td>
                  <td className="kt-report-num">{n(mean, digits)}</td>
                  <td className="kt-report-num">{upper === null ? "-" : n(upper, digits)}</td>
                  <td className="kt-report-num">{z > 0 ? "+" : ""}{n(z, 2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="kt-report-empty">{L("標本不足のため比較結果を保留しています。", "Comparison withheld because the sample is insufficient.")}</p>}
        <p className="kt-report-footnote">{L("仮定上限は実測のP95ではありません。勝率の分母は決着試合のみです。", "The upper marker is not an observed P95. Win rate uses decided matches only.")}</p>
      </ReportCard>
      <ReportCard title={L("ロビー帯別パフォーマンス", "Performance by lobby band")}
        description={lobby.sampledMatches ? `${L("平均ロビー", "Average lobby")}: ${lobby.avgLobbyTierName}` : undefined}>
        {lobby.sampledMatches ? (
          <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("ロビー帯別の表", "Lobby band table")}>
            <table className="kt-report-table">
              <thead><tr><th>{L("ランク帯", "Rank band")}</th><th>{L("試合 / W-L-D", "Matches / W-L-D")}</th>
                <th className="kt-report-num">{L("勝率", "Win rate")}</th><th className="kt-report-num">K/D</th>
                <th className="kt-report-num">ACS</th><th className="kt-report-num">HS%</th></tr></thead>
              <tbody>{lobby.eloBandPerformance.map((b) => (
                <tr key={b.bandName}><th scope="row">{b.bandName}</th>
                  <td>{b.matchesCount}<small>{b.wins}W / {b.losses}L / {b.draws}D</small></td>
                  <td className="kt-report-num">{b.wins + b.losses ? `${n(b.winRate, 1)}%` : "-"}</td>
                  <td className="kt-report-num">{n(b.kd, 2)}</td><td className="kt-report-num">{n(b.acs)}</td>
                  <td className="kt-report-num">{n(b.hsRate, 1)}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="kt-report-empty">{L("有効なロスターがありません。", "No valid roster sample.")}</p>}
      </ReportCard>
      {opp.totalOpponents ? (
        <ReportCard title={L("対戦相手のランク分布", "Opponent rank distribution")}
          description={L(`${opp.totalOpponents}人・各PUUIDの標本内最新ランク`, `${opp.totalOpponents} unique opponents, latest recorded rank per PUUID`)}>
          <div className="kt-report-servers">
            {Array.from(new Set(opp.tierDistribution.map((d) => Math.floor(d.tier / 3)))).sort((a, b) => b - a).map((band) => {
              const rows = opp.tierDistribution.filter((d) => Math.floor(d.tier / 3) === band);
              const count = rows.reduce((sum, r) => sum + r.count, 0);
              const percent = count / opp.totalOpponents * 100;
              const label = tierName(band * 3).replace(/ \d$/, "");
              return (
                <div key={band} className="kt-report-server">
                  <div><strong>{label}</strong><span>{count} / {n(percent, 1)}%</span></div>
                  <ReportMeter value={percent} label={label} />
                </div>
              );
            })}
          </div>
        </ReportCard>
      ) : null}
    </>
  );
}
