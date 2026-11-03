import type { Profile } from "@/lib/types";
import type { AccountReport } from "@/lib/report-model";
import { formatAct } from "@/lib/profile-stats";
import { AUDIT_COUNTRIES } from "@/lib/audit-countries";
import { AuditProgress } from "./audit-progress";
import { AuditTimeline } from "./audit-timeline";
import { AuditCountrySelect } from "./audit-country-select";
import {
  ReportCard, ReportMeter, ReportMethod, ReportRing, ReportScope, ReportSignals,
  reportNumber as n, reportText,
} from "./report-ui";

export function AccountAudit({ profile, report }: { profile: Profile; report: AccountReport }) {
  const { locale } = report;
  const L = reportText(locale);
  const { audit, comparison: cmp, lifetimeGenealogy: gen, serverStats } = report;
  const complete = report.auditCoverage?.state === "complete";
  const provisional = !complete && audit.score !== null;
  const tone = audit.score === null ? "neutral" : audit.score >= 70 ? "danger" : audit.score >= 25 ? "warn" : "good";
  const boundary = report.auditTimeline.candidates[0];
  const first = report.history[report.history.length - 1];
  const selectedCountry = audit.matchedCountry;
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
    [L("① 拠点・サーバー移管度", "① Base/server migration"), audit.breakdown.serverScore, 40, L("海外↔東京・国籍照合", "Overseas/Tokyo + optional country context")],
    [L("② フィジカル・戦闘変容度", "② Combat transformation"), audit.breakdown.performanceScore, 35, L("K/D・ACS・HS%の急変", "Abrupt K/D, ACS and HS% changes")],
    [L("③ ランク推移・デランク度", "③ Rank trajectory/derank"), audit.breakdown.rankScore, 35, L("ACT間の急上昇・急落", "Abrupt rises or drops between acts")],
    [L("④ 役割・行動変化", "④ Role/activity shift"), audit.breakdown.activityScore, 15, L("デュエリスト集中など", "Duelist concentration or role changes")],
  ] as const;
  return (
    <div className="kt-report">
      <div className="kt-report-audit-head">
        <div>
          <span className="v3-chip kt-report-badge">REFERENCE AUDIT</span>
          <h2>{L("アカウント査定・履歴変化判定", "Account audit / history-change assessment")}</h2>
          <p>{L("過去ランク・サーバー移行・戦闘成績の変化を組み合わせた参考評価です。", "Reference assessment combining rank history, server migration and combat-stat changes.")}</p>
        </div>
        <AuditCountrySelect
          label={L("出品国籍（任意）", "Listed country (optional)")}
          noneLabel={L("未選択", "Not selected")}
          options={AUDIT_COUNTRIES}
          selected={selectedCountry?.code ?? ""}
        />
      </div>
      <ReportScope report={report} locale={locale} />
      <div className="kt-report-layout">
        <aside className="kt-report-rail">
          <ReportCard title={L("査定スコア", "Audit score")}>
            <div className="kt-report-summary" data-tone={tone}>
              <ReportRing value={audit.score} label={L("履歴変化指数", "History-change index")} tone={tone} />
              <div>
                <div className="kt-report-grade" data-tone={tone}>{audit.grade ?? "-"}</div>
                <h3>
                  {audit.verdictLabel}
                  {provisional ? <span className="v3-chip kt-report-provisional">{L("暫定", "Provisional")}</span> : null}
                </h3>
                <p>{audit.confidenceLabel}{provisional ? L("・一覧データのみ", " · list data only") : ""}</p>
              </div>
            </div>
            <p className="kt-report-footnote">{audit.recommendation}</p>
            {selectedCountry ? (
              <p className="kt-report-footnote">
                {selectedCountry.emoji} {locale === "ja" ? selectedCountry.nameJa : selectedCountry.nameEn} ·
                {" "}{L("想定サーバー", "Expected server")} {selectedCountry.nativeServer} ·
                {" "}{serverStats.knownMatches
                  ? (audit.originMismatch ? L("観測主サーバーと不一致", "Observed main server differs") : L("観測主サーバーと一致", "Observed main server matches"))
                  : L("観測サーバー不明", "Observed server unknown")}
              </p>
            ) : null}
          </ReportCard>
          <ReportCard title={L("アカウント情報", "Account record")}>
            <dl className="kt-report-dl">
              {[
                [L("現在ランク", "Current rank"), profile.currentRank || "-"],
                [L("レベル", "Account level"), profile.level > 0 ? n(profile.level) : "-"],
                [L("初回記録ACT", "First recorded act"), first ? formatAct(first.act) : "-"],
                [L("取得済み試合", "Retrieved matches"), n(gen.totalLifetimeMatches)],
                [L("最古の記録", "Oldest record"), gen.oldestMatchDate || "-"],
                [L("最新の記録", "Newest record"), gen.newestMatchDate || "-"],
                [L("記録名", "Recorded name"), gen.originalName],
              ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="kt-report-footnote">{L("取得範囲のみ。生涯全試合・作成日は保証しません。", "Retrieved records only. Not guaranteed lifetime coverage or creation date.")}</p>
          </ReportCard>
          <AuditProgress key={profile.puuid} initial={report.auditCoverage} puuid={profile.puuid}
            name={profile.name} tag={profile.tag} locale={locale} availableMatches={report.sample.storedMatches} />
        </aside>
        <div className="kt-report-content">
          <ReportCard title={L("スコア内訳", "Score breakdown")}
            description={L("100点満点の参考指数です。確率・本人性・譲渡の断定ではありません。", "A 0-100 heuristic index, not a probability or a determination of identity/transfer.")}>
            <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("スコア内訳", "Score breakdown")}>
              <table className="kt-report-table">
                <thead><tr><th>{L("評価項目", "Indicator")}</th><th>{L("点 / 上限", "Points / limit")}</th><th>{L("内容", "Evidence")}</th></tr></thead>
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
          <div className="kt-report-pair">
            <ReportCard title={L("サーバー構成", "Server composition")}
              description={L(`判明 ${serverStats.knownMatches} / ${serverStats.total}試合`, `Known in ${serverStats.knownMatches} / ${serverStats.total} matches`)}>
              {gen.clusterTransition ? (
                <p className="kt-report-transition">
                  {gen.clusterTransition.from} → {gen.clusterTransition.to}
                  {gen.clusterTransition.date ? ` · ${gen.clusterTransition.date}` : ""}
                </p>
              ) : null}
              {serverStats.knownMatches ? <div className="kt-report-servers">
                {Object.entries(serverStats.clusters).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div className="kt-report-server" key={name}>
                    <div><strong>{name}</strong><span>{n(count)} / {n(serverStats.percentages[name], 1)}%</span></div>
                    <ReportMeter value={serverStats.percentages[name]} label={name} />
                  </div>
                ))}
              </div> : <p className="kt-report-empty">{L("サーバー情報は未取得です。", "Server data unavailable.")}</p>}
              <p className="kt-report-footnote">{L("利用サーバーは所在地を証明しません。", "Server choice does not establish location.")}</p>
            </ReportCard>
            <ReportCard title={L("移行前後の戦績", "Stats around migration")}
              description={gen.clusterTransition ? L("主サーバー移行の前後集計", "Aggregates on each side of the main-server boundary") : L("サーバー移行が未検出のため未集計", "Not computed because no primary-server transition was detected")}>
              {gen.preFlipStats && gen.postFlipStats ? (
                <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("移行前後", "Around migration")}>
                  <table className="kt-report-table">
                    <thead><tr><th>{L("指標", "Metric")}</th><th>{L("移行前", "Before")}</th><th>{L("移行後", "After")}</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">{L("試合", "Matches")}</th><td>{n(gen.preFlipStats.count)}</td><td>{n(gen.postFlipStats.count)}</td></tr>
                      <tr><th scope="row">K/D</th><td>{n(gen.preFlipStats.kd, 2)}</td><td>{n(gen.postFlipStats.kd, 2)}</td></tr>
                      <tr><th scope="row">ACS</th><td>{n(gen.preFlipStats.acs)}</td><td>{n(gen.postFlipStats.acs)}</td></tr>
                      <tr><th scope="row">{L("勝率", "Win rate")}</th><td>{n(gen.preFlipStats.winRate, 1)}%</td><td>{n(gen.postFlipStats.winRate, 1)}%</td></tr>
                    </tbody>
                  </table>
                </div>
              ) : <p className="kt-report-empty">{L("比較できるサーバー移行がありません。", "No comparable server boundary available.")}</p>}
            </ReportCard>
          </div>
          <AuditTimeline timeline={report.auditTimeline} locale={locale} />
          <ReportCard title={boundary ? L("変化点の前後比較", "Before / after boundary") : L("前期 / 後期の比較", "Early / recent comparison")}
            description={L(`${cmp.before.count} / ${cmp.after.count}試合・${boundary ? "最大変化点の隣接窓" : "時系列で二分"}`,
              `${cmp.before.count} / ${cmp.after.count} matches, ${boundary ? "strongest adjacent-window change" : "split chronologically"}`)}>
            {cmp.before.count && cmp.after.count ? (
              <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("期間比較", "Period comparison")}>
                <table className="kt-report-table">
                  <thead><tr><th>{L("指標", "Metric")}</th><th>{L("前期", "Early")}</th><th>{L("後期", "Recent")}</th><th>{L("差", "Delta")}</th></tr></thead>
                  <tbody>{metrics.map(([label, before, after, diff]) => (
                    <tr key={label}><th scope="row">{label}</th><td>{before}</td><td>{after}</td><td>{diff}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="kt-report-empty">{L("比較できる履歴がありません。", "No comparable history available.")}</p>}
            <p className="kt-report-footnote">{cmp.comparable
              ? L("同程度の記録ランク帯で比較。役割変更や成長は区別できません。", "Similar recorded rank environments. Role changes and improvement cannot be isolated.")
              : L("標本数・ランク帯・欠損の条件を満たさず、戦闘変化の採点は保留します。", "Sample, rank or completeness requirements are not met; combat-change scoring is withheld.")}
              <br />{L("射撃データ取得済み", "Shot data available")}: {cmp.before.accuracyCount} / {cmp.before.count} + {cmp.after.accuracyCount} / {cmp.after.count}
            </p>
          </ReportCard>
          <ReportCard title={L("ACT・ランク履歴", "Act / rank history")}
            description={L("査定に使った年代調整後の履歴", "Era-adjusted history used by the audit")}>
            {report.history.length ? (
              <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("ACT履歴", "Act history")}>
                <table className="kt-report-table">
                  <thead><tr><th>ACT</th><th>{L("最終ランク", "Final rank")}</th><th>{L("勝敗", "W/L")}</th><th>{L("主サーバー", "Primary server")}</th></tr></thead>
                  <tbody>{report.history.slice(0, 12).map((row) => (
                    <tr key={row.act}>
                      <th scope="row">{formatAct(row.act)}</th>
                      <td>{row.tier > 0 ? row.rankName : L("未ランク", "Unranked")}</td>
                      <td>{n(row.wins)}-{n(Math.max(0, row.games - row.wins))} ({n(row.winRate)}%)</td>
                      <td>{row.primaryServer || "-"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="kt-report-empty">{L("ランク履歴がありません。", "No act rank history available.")}</p>}
          </ReportCard>
          <ReportSignals signals={audit.signals} locale={locale} />
          <ReportMethod locale={locale} />
        </div>
      </div>
    </div>
  );
}
