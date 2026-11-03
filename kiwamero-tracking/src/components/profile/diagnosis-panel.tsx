import type { Profile } from "@/lib/types";
import type { AccountReport } from "@/lib/report-model";
import { DiagnosisLobby } from "./diagnosis-lobby";
import { DiagnosisPillars } from "./diagnosis-pillars";
import { DiagnosisScoreCards, DiagnosisSummaryCard } from "./diagnosis-score";
import {
  ReportCard, ReportMethod, ReportScope, ReportSignals, reportNumber as n, reportText,
} from "./report-ui";

export function DiagnosisPanel({ profile, report }: { profile: Profile; report: AccountReport }) {
  const { locale } = report;
  const L = reportText(locale);
  const v = report.verdict;
  const bc = v.benchmarksComparison;
  const decided = v.lobbyAnalysis.eloBandPerformance.reduce((sum, band) => sum + band.wins + band.losses, 0);
  return (
    <div className="kt-report">
      <div className="kt-report-audit-head">
        <div>
          <span className="v3-chip kt-report-badge">REFERENCE DIAGNOSIS</span>
          <h2>{L("スマーフ診断・参考モデル", "Smurf diagnosis / reference model")}</h2>
          <p>{L("直近の対戦ロスターから、ランク差・サブ垢兆候・統計的異常を参考指数として整理します。", "Summarizes rank mismatch, alt-account indicators and statistical outliers from recent full rosters.")}</p>
        </div>
      </div>
      <ReportScope report={report} locale={locale} diagnosis />
      <div className="kt-report-layout">
        <aside className="kt-report-rail">
          <DiagnosisSummaryCard profile={profile} report={report} />
          <ReportCard title={L("分析対象", "Sample details")}>
            <dl className="kt-report-dl">
              {[
                [L("有効ロスター", "Valid rosters"), `${v.lobbyAnalysis.sampledMatches} / ${report.sample.rosterMatches}`],
                [L("決着試合", "Decided matches"), n(decided)],
                [L("標本の開始", "Sample from"), report.sample.diagnosisFrom || "-"],
                [L("標本の終了", "Sample to"), report.sample.diagnosisTo || "-"],
                [L("標本内の本人ランク", "Owner's sample rank"), bc?.currentRankName || "-"],
                [L("主ロール", "Primary role"), bc ? bc.role[0].toUpperCase() + bc.role.slice(1) : "-"],
                [L("対戦相手数", "Opponents"), n(v.lobbyAnalysis.encounteredOpponents.totalOpponents)],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="kt-report-footnote">{L("成績・ロール・本人ランクは同じ標本から計算します。", "Stats, role and owner rank come from the same match sample.")}</p>
          </ReportCard>
        </aside>
        <div className="kt-report-content">
          <DiagnosisScoreCards profile={profile} report={report} />
          <DiagnosisPillars profile={profile} report={report} />
          <DiagnosisLobby report={report} locale={locale} />
          <ReportSignals signals={v.signals} locale={locale} />
          <ReportMethod locale={locale} diagnosis />
        </div>
      </div>
    </div>
  );
}
