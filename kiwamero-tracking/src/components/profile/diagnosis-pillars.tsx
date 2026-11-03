import Image from "next/image";
import { Crosshair, Gauge, Target } from "lucide-react";
import type { Profile } from "@/lib/types";
import type { AccountReport, BandPerformance } from "@/lib/report-model";
import { tierIcon } from "@/lib/henrik-shared";
import { ReportCard, reportNumber as n, reportText } from "./report-ui";

type Evaluation = BandPerformance["evaluation"];

function parityText(evaluation: Evaluation, ja: boolean): string {
  const labels: Record<Evaluation, [string, string]> = {
    far_above: ["格上制圧", "Dominant"],
    above_average: ["上位昇格水準", "Above-rank level"],
    average: ["適正水準", "At-rank level"],
    below_average: ["やや苦戦", "Below-rank level"],
    far_below: ["苦戦傾向", "Struggling"],
  };
  return labels[evaluation][ja ? 0 : 1];
}

export function DiagnosisPillars({ profile, report }: { profile: Profile; report: AccountReport }) {
  const L = reportText(report.locale);
  const ja = report.locale === "ja";
  const verdict = report.verdict;
  const lobby = verdict.lobbyAnalysis;
  const est = verdict.estimatedTrueRank;
  const z = verdict.benchmarksComparison?.zScores.compositeZ;
  const decided = lobby.eloBandPerformance.reduce((sum, band) => sum + band.wins + band.losses, 0);
  const confidence = lobby.sampledMatches >= 15
    ? L("高 (15戦以上)", "High (15+ matches)")
    : decided >= 5
      ? L("中 (5決着以上)", "Moderate (5+ decided)")
      : L("低", "Low");
  return (
    <ReportCard title={L("実力判定（3点照合モデル）", "Skill estimate (3-point model)")}
      description={L("表示ランク・対戦ロビー平均・参考推定ランクを同じ標本で照合します。", "Compares displayed rank, average lobby and model reference rank from the same sample.")}>
      <div className="kt-report-pillars">
        <section className="kt-report-pillar">
          <div className="kt-report-pillar-head"><span><Crosshair size={13} aria-hidden="true" />{L("現在の表示ランク", "Displayed rank")}</span><em>{L("名目", "Nominal")}</em></div>
          <div className="kt-report-rank-mini">
            {profile.currentTier ? <Image src={tierIcon(profile.currentTier)} alt="" width={56} height={56} unoptimized /> : <span className="kt-report-rank-empty">-</span>}
            <div><strong>{profile.currentRank || "-"}</strong><small>{L("表面上の所属ディビジョン", "Visible division")}</small></div>
          </div>
        </section>
        <section className="kt-report-pillar" data-tone="sky">
          <div className="kt-report-pillar-head"><span><Gauge size={13} aria-hidden="true" />{L("対戦ロビー平均", "Average lobby")}</span><em>{L("難易度アンカー", "Difficulty anchor")}</em></div>
          <div className="kt-report-rank-mini">
            {lobby.avgLobbyTier > 0 ? <Image src={tierIcon(Math.round(lobby.avgLobbyTier))} alt="" width={56} height={56} unoptimized /> : <span className="kt-report-rank-empty">-</span>}
            <div>
              <strong>{lobby.avgLobbyTier > 0 ? lobby.avgLobbyTierName : "-"}</strong>
              <small>{lobby.tierSpan !== "—" ? `${L("配属帯", "Observed range")}: ${lobby.tierSpan}` : L("ロビー情報なし", "No lobby data")}</small>
              {z !== undefined ? <span className="v3-chip kt-report-pillar-chip">{parityText(lobby.combatParity, ja)} ({z > 0 ? "+" : ""}{n(z, 2)}σ)</span> : null}
            </div>
          </div>
        </section>
        <section className="kt-report-pillar" data-tone="violet">
          <div className="kt-report-pillar-head"><span><Target size={13} aria-hidden="true" />{L("参考推定ランク", "Reference estimate")}</span><em>MODEL</em></div>
          {est ? (
            <div className="kt-report-rank-mini">
              <Image src={tierIcon(est.tier)} alt="" width={56} height={56} unoptimized />
              <div>
                <strong>{est.tierName}</strong>
                <small>
                  {est.tierGap > 0
                    ? `+${est.tierGap} ${L("段階上位の参考値", "tiers above sample rank")}`
                    : est.tierGap < 0
                      ? `${est.tierGap} ${L("段階下位の参考値", "tiers below sample rank")}`
                      : L("標本ランク相応", "At sample-rank level")}
                </small>
                <small>{L("モデル信頼度", "Model confidence")}: {confidence}</small>
                <small>{L("モデル幅", "Model range")}: {est.modelRange.spanText}</small>
              </div>
            </div>
          ) : <p className="kt-report-empty kt-report-empty--compact">{L("有効な標本が揃うまで参考ランクを表示しません。", "Reference rank is withheld until enough valid data is available.")}</p>}
        </section>
      </div>
      {lobby.performanceDescription ? (
        <p className="kt-report-description">{lobby.performanceDescription}</p>
      ) : null}
      <p className="kt-report-footnote">{L("モデル幅は統計的な信頼区間ではありません。参考ランクは推定実力の確定値でもありません。", "The model range is not a statistical confidence interval. Reference rank is not a verified skill rating.")}</p>
    </ReportCard>
  );
}
