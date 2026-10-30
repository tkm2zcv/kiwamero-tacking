import type { Profile } from "@/lib/types";
import type { AccountReport } from "@/lib/report-model";
import { formatAct } from "@/lib/profile-stats";
import { AuditProgress } from "./audit-progress";
import { AuditTimeline } from "./audit-timeline";
import {
  ReportCard, ReportMeter, ReportMethod, ReportRing, ReportScope, ReportSignals,
  reportNumber as n, reportText,
} from "./report-ui";

export function AccountAudit({ profile, report }: { profile: Profile; report: AccountReport }) {
  const { locale } = report;
  const L = reportText(locale);
  const { audit, comparison: cmp, lifetimeGenealogy: gen, serverStats } = report;
  const complete = report.auditCoverage?.state === "complete";
  const tone = !complete || audit.score === null || !cmp.comparable ? "neutral" : audit.score >= 45 ? "warn" : "good";
  const boundary = report.auditTimeline.candidates[0];
  const first = report.history[report.history.length - 1];
  const metrics = [
    ["K/D", n(cmp.before.kd, 2), n(cmp.after.kd, 2), n(cmp.kdDiff, 2)],
    ["ACS", n(cmp.before.acs), n(cmp.after.acs), n(cmp.acsDiff)],
    ["HS%",
      cmp.before.accuracyCount ? `${n(cmp.before.hsRate, 1)}%` : "-",
      cmp.after.accuracyCount ? `${n(cmp.after.hsRate, 1)}%` : "-",
      cmp.before.accuracyCount && cmp.after.accuracyCount ? `${n(cmp.hsDiff, 1)}pt` : "-"],
    [L("勝率", "Win rate"), `${n(cmp.before.winRate, 1)}%`, `${n(cmp.after.winRate, 1)}%`, "-"],
  ];
  const breakdown = [
    [L("ランク変化", "Rank changes"), audit.breakdown.rankScore, 30, L("隣接ACT間の差", "Differences between adjacent acts")],
    [L("成績変化", "Performance"), audit.breakdown.performanceScore, 40, L("比較可能な期間の複数指標", "Multiple metrics in comparable periods")],
    [L("サーバー変化", "Server pattern"), audit.breakdown.serverScore, 15, L("成績変化との組合せのみ", "Only combined with performance changes")],
    [L("使用傾向変化", "Agent pattern"), audit.breakdown.activityScore, 15, L("成績変化との組合せのみ", "Only combined with performance changes")],
  ] as const;
  return (
    <div className="kt-report">
      <ReportScope report={report} locale={locale} />
      <AuditProgress key={profile.puuid} initial={report.auditCoverage} puuid={profile.puuid}
        name={profile.name} tag={profile.tag} locale={locale} availableMatches={report.sample.storedMatches} />
      <div className="kt-report-layout">
        <aside className="kt-report-rail">
          <ReportCard title={L("アカウント査定", "Account audit")}>
            <div className="kt-report-summary" data-tone={tone}>
              <ReportRing value={audit.score} label={L("履歴変化指数", "History-change index")} tone={tone} />
              <div><h3>{complete ? audit.title : L("取得範囲の暫定評価", "Provisional history assessment")}</h3><p>{audit.confidenceLabel}</p></div>
            </div>
            <p className="kt-report-footnote">{audit.recommendation}</p>
          </ReportCard>
          <ReportCard title={L("アカウント情報", "Account record")}>
            <dl className="kt-report-dl">
              {[
                [L("現在ランク", "Current rank"), profile.currentRank || "-"],
                [L("レベル", "Account level"), profile.level > 0 ? n(profile.level) : "-"],
                [L("初回記録ACT", "First recorded act"), first ? formatAct(first.act) : "-"],
                [L("取得済み試合", "Retrieved matches"), n(gen.totalLifetimeMatches)],
                [L("評価対象外の記録ID", "Excluded record IDs"), n(report.sample.excludedStoredMatches)],
                [L("最古の記録", "Oldest record"), gen.oldestMatchDate || "-"],
                [L("最新の記録", "Newest record"), gen.newestMatchDate || "-"],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="kt-report-footnote">{L("取得範囲のみ。生涯全試合・作成日は保証しません。", "Retrieved records only. Not guaranteed lifetime coverage or creation date.")}</p>
          </ReportCard>
        </aside>
        <div className="kt-report-content">
          <ReportCard title={L("指数の内訳", "Change index breakdown")}
            description={L("変化を示す参考指数です。本人性や所有者変更の確率ではありません。", "Descriptive change index, not a probability of an identity or ownership change.")}>
            <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("指数の内訳", "Index breakdown")}>
              <table className="kt-report-table">
                <thead><tr><th>{L("評価項目", "Indicator")}</th><th>{L("参考点 / 上限", "Points / limit")}</th><th>{L("条件", "Condition")}</th></tr></thead>
                <tbody>{breakdown.map(([label, value, max, note]) => (
                  <tr key={label}><th scope="row">{label}</th><td>
                    <div className="kt-report-score-cell" data-tone={value ? "warn" : "neutral"}>
                      <ReportMeter value={audit.score === null ? null : value} max={max} label={label} />
                      <strong>{audit.score === null ? "-" : value}</strong><small>/ {max}</small>
                    </div>
                  </td><td className="kt-report-cell-note">{note}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </ReportCard>
          <AuditTimeline timeline={report.auditTimeline} locale={locale} />
          <div className="kt-report-pair">
            <ReportCard title={boundary ? L("変化点の前後比較", "Before / after boundary") : L("前半 / 後半の比較", "Early / recent comparison")}
              description={L(`${cmp.before.count} / ${cmp.after.count}試合・${boundary ? "最大変化点の隣接窓" : "時系列で二分"}`,
                `${cmp.before.count} / ${cmp.after.count} matches, ${boundary ? "strongest adjacent-window change" : "split chronologically"}`)}>
              {cmp.before.count && cmp.after.count ? (
                <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("期間比較", "Period comparison")}>
                  <table className="kt-report-table">
                    <thead><tr><th>{L("指標", "Metric")}</th><th>{L("前半", "Early")}</th><th>{L("後半", "Recent")}</th><th>{L("差", "Delta")}</th></tr></thead>
                    <tbody>{metrics.map(([label, before, after, diff]) => (
                      <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td><td>{diff}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p className="kt-report-empty">{L("比較できる履歴がありません。", "No comparable history available.")}</p>}
              <p className="kt-report-footnote">{cmp.comparable
                ? L("同程度の記録ランク帯で比較。役割変更や成長は区別できません。", "Similar recorded rank environments. Role changes and improvement cannot be isolated.")
                : L("標本数・ランク帯・欠損の条件を満たさず、成績変化の採点は保留します。", "Sample, rank or completeness requirements are not met; performance-change scoring is withheld.")}
                <br />{L("射撃データ取得済み", "Shot data available")}: {cmp.before.accuracyCount} / {cmp.before.count} + {cmp.after.accuracyCount} / {cmp.after.count}
              </p>
            </ReportCard>
            <ReportCard title={L("利用サーバー", "Server distribution")}
              description={L(`判明 ${serverStats.knownMatches} / ${serverStats.total}試合`, `Known in ${serverStats.knownMatches} / ${serverStats.total} matches`)}>
              {serverStats.knownMatches ? <div className="kt-report-servers">
                {Object.entries(serverStats.clusters).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div className="kt-report-server" key={name}>
                    <div><strong>{name}</strong><span>{n(count)} / {n(serverStats.percentages[name], 1)}%</span></div>
                    <ReportMeter value={serverStats.percentages[name]} label={name} />
                  </div>
                ))}
              </div> : <p className="kt-report-empty">{L("サーバー情報は未取得です。", "Server data unavailable.")}</p>}
              <p className="kt-report-footnote">{L("割合は判明試合が分母です。利用サーバーは所在地を証明しません。", "Percentages use known-server matches. Server choice does not establish location.")}</p>
            </ReportCard>
          </div>
          <ReportSignals signals={audit.signals} locale={locale} />
          <ReportMethod locale={locale} />
        </div>
      </div>
    </div>
  );
}
