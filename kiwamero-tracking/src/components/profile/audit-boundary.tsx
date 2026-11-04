import type { AccountReport } from "@/lib/report-model";
import { tierName } from "@/lib/henrik-shared";
import { ReportCard, reportNumber as n, reportText } from "./report-ui";

export function AuditBoundary({ report }: { report: AccountReport }) {
  const L = reportText(report.locale);
  const { audit, comparison: cmp } = report;
  const boundary = audit.boundary;
  const origin = audit.originShift;
  const capability = audit.capability;
  const originOnly = !boundary && (!!audit.originScored || !!audit.capabilityScored);
  const date = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
  const metrics = [
    ["K/D", n(cmp.before.kd, 2), n(cmp.after.kd, 2), n(cmp.kdDiff, 2)],
    [L("本人の平均記録ランク", "Owner's mean recorded rank"),
      cmp.before.meanTier ? tierName(Math.round(cmp.before.meanTier)) : "-",
      cmp.after.meanTier ? tierName(Math.round(cmp.after.meanTier)) : "-", "-"],
    ["ACS", n(cmp.before.acs), n(cmp.after.acs), n(cmp.acsDiff)],
    ["HS%", cmp.before.accuracyCount ? `${n(cmp.before.hsRate, 1)}%` : "-",
      cmp.after.accuracyCount ? `${n(cmp.after.hsRate, 1)}%` : "-", "-"],
  ];
  return (
    <ReportCard title={L("判定の根拠・前後比較", "Evidence and before/after comparison")}
      description={boundary
        ? `${date(boundary.at)} · ${date(boundary.from)} - ${date(boundary.to)}`
        : originOnly
          ? L("過去・初期の実績と直近40試合を比較。変化した日時や、各変化の同時発生は特定していません。", "Historical evidence is compared with current40. Change dates and coincidence are not established.")
          : L("採点対象の変化点は未検出。前後半の数値は参考表示のみです。", "No scored boundary. Half-history values are descriptive only.")}>
      {origin ? <p className="kt-report-description">
        {origin.from} → {origin.to}。{" "}
        {L(`初期20試合中${origin.earlyMatches}試合（${date(origin.earlyFrom)}〜${date(origin.earlyTo)}）と、直近40試合中${origin.recentMatches}試合（${date(origin.recentFrom)}〜${date(origin.recentTo)}）。`,
          `${origin.earlyMatches}/20 initial matches (${date(origin.earlyFrom)} to ${date(origin.earlyTo)}) and ${origin.recentMatches}/40 recent matches (${date(origin.recentFrom)} to ${date(origin.recentTo)}).`)}
        {" "}{audit.originScored
          ? L("長期的な拠点変化をサーバー項目へ反映。局所移行と二重加点しません。", "Stable origin evidence contributes once to the server score, not twice with the local switch.")
          : L("参考表示です。評価保留、または別時期の採点対象には合算しません。", "Context only: withheld or not combined with another scored event.")}
        {origin.gapDays >= 30 ? L(" 長い履歴欠落があり、移行時期や休止の影響は不明です。", " Recording gaps leave migration timing and inactivity effects unknown.") : ""}
        {" "}{L("保存履歴の最初であり、作成時の居住地ではありません。", "This is the start of stored history, not residence at account creation.")}
      </p> : null}
      {capability ? <p className="kt-report-description">
        {L("過去の確認実績", "Historical reference")}: {tierName(capability.priorTier)}。{" "}
        {capability.source === "act"
          ? L(`${capability.priorAct?.toUpperCase()}の到達ランクです（ACT全体${capability.priorGames}試合。全試合をそのランクで戦った意味ではありません）。`,
            `Peak in ${capability.priorAct?.toUpperCase()} (${capability.priorGames} total ACT games, not games all played at that peak).`)
          : L(`同ランク以上の本人記録${capability.priorGames}試合。`, `${capability.priorGames} observed owner-rank matches at or above this tier.`)}
        {" "}{L(`直近40試合（${date(capability.recentFrom)}〜${date(capability.recentTo)}）のK/Dは${n(capability.recentKd, 2)}、各20試合も${capability.halfKd.map((v) => n(v, 2)).join(" / ")}。平均本人ランクは${tierName(Math.round(capability.recentMeanTier))}です。`,
          `Current40 (${date(capability.recentFrom)} to ${date(capability.recentTo)}): K/D${n(capability.recentKd, 2)}, ${capability.halfKd.map((v) => n(v, 2)).join(" / ")} per20; mean owner rank ${tierName(Math.round(capability.recentMeanTier))}.`)}
        {" "}{audit.capabilityScored
          ? L("同じ現在期間の拠点差と評価します。局所変化の点数は重ねません。", "Assessed with origin evidence on the same current sample; local-event scores are not added.")
          : L("より強い局所評価を採用し、重複加点しません。", "A stronger local assessment is selected without duplicate points.")}
        {capability.roleChanged ? L(" 観測された主ロール変更により戦闘項目を10点減らします。", " An observed primary-role change reduces combat points by10.") : ""}
        {capability.gapDays >= 30 ? L(" 履歴欠落があり、休止・加齢・環境変化の影響は未確認です。", " Historical gaps leave inactivity, ageing and environment effects unverified.") : ""}
      </p> : null}
      {boundary ? <p className="kt-report-description">
        {boundary.persistentLowKd
          ? L("以前の成績に対し低K/Dが継続する境界です。", "Low K/D persists relative to the preceding performance.")
          : boundary.kind === "performance"
            ? L("K/Dが持続的に変化した境界です。", "A sustained K/D change was observed.")
            : audit.originScored
              ? L("初期からの拠点変更が直近でも定着しています。K/Dの急変は未検出です。", "The initial server change remains established recently. No K/D discontinuity was detected.")
              : L("局所的なサーバー移行の参考材料です。K/Dの急変は未検出です。", "Local server-switch evidence without a K/D discontinuity.")}
        {" "}{L(`前後${cmp.before.count}/${cmp.after.count}試合。同じ境界の情報だけを採点します。`,
          `${cmp.before.count}/${cmp.after.count} matches before/after. Only evidence from this boundary contributes.`)}
        {boundary.gapDays >= 30 ? L(" 境界に30日以上の記録欠落があり、局所項目の加点を半減しています。初期・直近の拠点差は別評価です。", " A30+ day gap halves local contributions; initial/current origin evidence is assessed separately.") : ""}
        {boundary.kind === "performance" && boundary.roleChanged ? L(" ロール変更を考慮して戦闘項目を減点します。", " A role change reduces the combat contribution.") : ""}
        {audit.score === null ? L(" 総合評価は保留です。", " Overall assessment is withheld.") : ""}
      </p> : null}
      {originOnly ? null : cmp.before.count && cmp.after.count ? (
        <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("期間比較", "Period comparison")}>
          <table className="kt-report-table">
            <thead><tr><th>{L("指標", "Metric")}</th><th>{L("前", "Before")}</th><th>{L("後", "After")}</th><th>{L("差", "Delta")}</th></tr></thead>
            <tbody>{metrics.map(([label, before, after, diff]) => (
              <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td><td>{diff}</td></tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="kt-report-empty">{L("比較できる履歴がありません。", "No comparable history available.")}</p>}
      <p className="kt-report-footnote">
        {L("本人ランクは対戦相手の強さを保証しません。対戦相手・マップ・パーティの影響は未確認です。HS%・ACSは補助表示で、採点の必須条件ではありません。",
          "Owner rank does not establish opponent strength. Opponent, map and party effects remain unverified. HS%/ACS are descriptive, not scoring prerequisites.")}
        {!originOnly ? <><br />{L("射撃データ取得済み", "Shot data available")}: {cmp.before.accuracyCount}/{cmp.before.count} + {cmp.after.accuracyCount}/{cmp.after.count}</> : null}
      </p>
    </ReportCard>
  );
}
