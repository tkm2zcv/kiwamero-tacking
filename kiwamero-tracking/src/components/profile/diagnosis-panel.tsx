import Image from "next/image";
import { tierIcon, tierName } from "@/lib/henrik-shared";
import type { AccountReport } from "@/lib/report-model";
import { DiagnosisLobby } from "./diagnosis-lobby";
import {
  ReportCard, ReportMethod, ReportRing, ReportScope, ReportSignals, reportText,
} from "./report-ui";

export function DiagnosisPanel({ report }: { report: AccountReport }) {
  const { locale } = report;
  const L = reportText(locale);
  const v = report.verdict;
  const est = v.estimatedTrueRank;
  const bc = v.benchmarksComparison;
  const tone = v.scores.smurfScore === null ? "neutral"
    : v.verdict.color === "amber" ? "warn" : "good";
  const scores = [
    [L("ランク差指数", "Rank mismatch"), v.scores.smurfScore],
    [L("サブ垢参考値", "Alt indicators"), v.scores.altScore],
    [L("外れ値指数", "Stat outliers"), v.scores.outlierScore],
  ] as const;
  return (
    <div className="kt-report">
      <ReportScope report={report} locale={locale} diagnosis />
      <div className="kt-report-layout">
        <aside className="kt-report-rail">
          <ReportCard title={L("スマーフ診断", "Smurf analysis")}>
            <div className="kt-report-summary" data-tone={tone}>
              <ReportRing value={v.scores.smurfScore} label={L("ランク差指数", "Rank mismatch")} tone={tone} />
              <div><h3>{v.verdict.label}</h3><p>{v.verdict.sublabel}</p></div>
            </div>
            <p className="kt-report-footnote">{L("参考モデルによる分析。不正・スマーフを確定する機能ではありません。", "Reference-model analysis. Does not establish cheating or smurfing.")}</p>
          </ReportCard>
          <ReportCard title={L("分析対象", "Sample details")}>
            <dl className="kt-report-dl">
              {[
                [L("有効ロスター", "Valid rosters"), `${v.lobbyAnalysis.sampledMatches} / ${report.sample.rosterMatches}`],
                [L("標本の開始", "Sample from"), report.sample.diagnosisFrom || "-"],
                [L("標本の終了", "Sample to"), report.sample.diagnosisTo || "-"],
                [L("標本内の本人ランク", "Owner's sample rank"), bc?.currentRankName || "-"],
                [L("主ロール", "Primary role"), bc ? bc.role[0].toUpperCase() + bc.role.slice(1) : "-"],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="kt-report-footnote">{L("成績・ロール・本人ランクは同じ標本から計算します。", "Stats, role and owner rank come from the same match sample.")}</p>
          </ReportCard>
        </aside>
        <div className="kt-report-content">
          <ReportCard title={L("診断の内訳", "Indicator overview")}
            description={L("0〜100の参考指数。確率・母集団パーセンタイルではありません。", "Reference indices from 0-100. Not probabilities or population percentiles.")}>
            <div className="kt-report-tiles">
              {scores.map(([label, score]) => (
                <div className="kt-report-tile" key={label} data-tone={score === null ? "neutral" : score >= 50 ? "warn" : "good"}>
                  <span>{label}</span><strong>{score ?? "-"}<em>/ 100</em></strong>
                  <small>{score === null ? L("データ不足", "Unavailable") : L("参考指数", "Reference index")}</small>
                </div>
              ))}
            </div>
          </ReportCard>
          <ReportCard title={L("参考ランク", "Model reference rank")}
            description={L("ロビー成績を仮定モデルに当てはめた目安です。実力の確定値ではありません。", "A heuristic reading of lobby performance, not a verified skill rating.")}>
            {est ? (
              <>
                <div className="kt-report-rank">
                  <Image src={tierIcon(est.tier)} alt="" width={72} height={72} unoptimized />
                  <div><small>{L("参考モデル", "Reference model")}</small><strong>{est.tierName}</strong>
                    <p>{`${L("標本内ランク", "Sample rank")}: ${tierName(v.currentTier)} / ${est.tierGap > 0 ? "+" : ""}${est.tierGap} ${L("ティア", "tiers")}`}</p>
                  </div>
                </div>
                <dl className="kt-report-dl"><div>
                  <dt>{L("モデル上の幅", "Model range")}</dt><dd>{est.modelRange.spanText}</dd>
                </div></dl>
                <p className="kt-report-footnote">{L("幅はモデルの仮定に基づきます。統計的な90%信頼区間ではありません。", "Range reflects model assumptions, not a statistical confidence interval.")}</p>
              </>
            ) : <p className="kt-report-empty">{L("有効な標本が揃うまで参考ランクを表示しません。", "Reference rank is withheld until enough valid data is available.")}</p>}
          </ReportCard>
          <DiagnosisLobby report={report} locale={locale} />
          <ReportSignals signals={v.signals} locale={locale} />
          <ReportMethod locale={locale} diagnosis />
        </div>
      </div>
    </div>
  );
}
