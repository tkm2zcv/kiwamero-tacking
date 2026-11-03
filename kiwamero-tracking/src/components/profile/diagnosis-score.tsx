import { Activity, Radar, ShieldAlert, UserCheck } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AccountReport, SmurfVerdict } from "@/lib/report-model";
import { ReportCard, ReportMeter, ReportRing, reportNumber as n, reportText } from "./report-ui";

function overallScore(verdict: SmurfVerdict): number | null {
  const scores = [verdict.scores.smurfScore, verdict.scores.altScore, verdict.scores.outlierScore]
    .filter((score): score is number => score !== null);
  return scores.length ? Math.max(...scores) : null;
}

function verdictTone(verdict: SmurfVerdict): string {
  if (verdict.verdict.type === "INSUFFICIENT_DATA") return "neutral";
  if (verdict.verdict.type === "STATS_OUTLIER") return "danger";
  if (verdict.verdict.type === "ALT_ACCOUNT") return "sky";
  if (verdict.verdict.type === "SMURF_SUSPECT") return "violet";
  return "good";
}

export function DiagnosisSummaryCard({ profile, report }: { profile: Profile; report: AccountReport }) {
  const L = reportText(report.locale);
  const verdict = report.verdict;
  const overall = overallScore(verdict);
  const tone = verdictTone(verdict);
  return (
    <ReportCard title={L("総合診断判定", "Overall diagnosis")}>
      <div className="kt-report-summary" data-tone={tone}>
        <ReportRing value={overall} label={L("総合診断指数", "Overall index")} tone={tone} />
        <div>
          <h3>{verdict.verdict.label}</h3>
          <p>{verdict.verdict.sublabel}</p>
          <p className="kt-report-account-level">Account Lv. {profile.level > 0 ? n(profile.level) : "-"}</p>
        </div>
      </div>
      <p className="kt-report-footnote">{L("ランク差・サブ垢参考値・統計的異常度の最大値です。確率ではありません。", "Highest of rank-mismatch, alt-account and outlier indices. Not a probability.")}</p>
    </ReportCard>
  );
}

export function DiagnosisScoreCards({ profile, report }: { profile: Profile; report: AccountReport }) {
  const L = reportText(report.locale);
  const verdict = report.verdict;
  const z = verdict.benchmarksComparison?.zScores.compositeZ;
  const cards = [
    {
      icon: Radar,
      tone: "violet",
      label: L("スマーフ度指数", "Smurf index"),
      value: verdict.scores.smurfScore,
      note: L(`同ランク帯モデルとの偏差 ${z === undefined ? "-" : `${z > 0 ? "+" : ""}${n(z, 2)}`}`,
        `Deviation vs same-rank model ${z === undefined ? "-" : `${z > 0 ? "+" : ""}${n(z, 2)}`}`),
    },
    {
      icon: UserCheck,
      tone: "sky",
      label: L("サブ垢参考値", "Alt-account index"),
      value: verdict.scores.altScore,
      note: L(`アカウントLv.${profile.level > 0 ? n(profile.level) : "-"}・低レベル×ランク差`,
        `Account Lv.${profile.level > 0 ? n(profile.level) : "-"} · low-level + rank gap`),
    },
    {
      icon: ShieldAlert,
      tone: "danger",
      label: L("統計的異常度", "Statistical outlier"),
      value: verdict.scores.outlierScore,
      note: L("仮定上限を超える指標の数と幅", "Count and size of metrics above model upper markers"),
    },
  ] as const;
  return (
    <ReportCard title={L("診断の内訳", "Indicator overview")}
      description={L("0〜100の参考指数。確率・母集団パーセンタイル・不正検出ではありません。", "Reference indices from 0-100. Not probabilities, population percentiles or cheat detection.")}>
      <div className="kt-report-tiles kt-report-tiles--diagnosis">
        {cards.map((card) => (
          <div className="kt-report-tile" key={card.label} data-tone={card.value === null ? "neutral" : card.tone}>
            <span className="kt-report-tile-label"><card.icon size={15} aria-hidden="true" />{card.label}</span>
            <strong>{card.value ?? "-"}<em>/ 100</em></strong>
            <ReportMeter value={card.value} label={card.label} tone={card.value === null ? "neutral" : card.tone} />
            <small>{card.note}</small>
          </div>
        ))}
      </div>
      <p className="kt-report-footnote"><Activity size={13} aria-hidden="true" /> {L("各指数は条件を満たす場合だけ採点します。0は正常証明ではありません。", "Indices are scored only when their gates are met. Zero is not proof of normality.")}</p>
    </ReportCard>
  );
}
