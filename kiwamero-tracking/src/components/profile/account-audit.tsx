import Image from "next/image";
import type { Profile } from "@/lib/types";
import type { AccountReport } from "@/lib/report-model";
import { formatAct } from "@/lib/profile-stats";
import { AUDIT_COUNTRIES } from "@/lib/audit-countries";
import { tierIcon } from "@/lib/henrik-shared";
import { ServerLabel } from "@/components/server-label";
import { AuditProgress } from "./audit-progress";
import { AuditTimeline } from "./audit-timeline";
import { AuditCountrySelect } from "./audit-country-select";
import { AuditBoundary } from "./audit-boundary";
import {
  ReportCard, ReportMeter, ReportMethod, ReportRing, ReportScope, ReportSignals,
  reportNumber as n, reportText,
} from "./report-ui";

export function AccountAudit({ profile, report }: { profile: Profile; report: AccountReport }) {
  const { locale } = report;
  const L = reportText(locale);
  const { audit, lifetimeGenealogy: gen, serverStats } = report;
  const complete = report.auditCoverage?.state === "complete";
  const provisional = !complete && audit.score !== null;
  const tone = audit.score === null ? "neutral" : audit.score >= 70 ? "danger" : audit.score >= 25 ? "warn" : "good";
  const first = report.history[report.history.length - 1];
  const selectedCountry = audit.matchedCountry;
  const breakdown = [
    [L("① 持続的な戦闘成績の不一致", "① Persistent combat mismatch"), audit.breakdown.performanceScore, 55, L("直近40試合の苦戦、または局所的なK/D変化", "Current40 underperformance or a local K/D change")],
    [L("② 過去実績との食い違い", "② Prior-performance mismatch"), audit.breakdown.rankScore, 20, L("本人ランク低下でも低K/D", "Low K/D despite lower owner ranks")],
    [L("③ 主な利用拠点の変化", "③ Primary-server change"), audit.breakdown.serverScore, 30, L("初期からの定着30点・局所10/20点と重複なし", "Stable origin shift: 30; no double-counting with local 10/20")],
    [L("④ 同期間の活動時間変化", "④ Concurrent play-hours shift"), audit.breakdown.activityScore, 5, L("UTC分布の変化・所在地ではない", "UTC distribution, not physical location")],
  ] as const;
  return (
    <div className="kt-report">
      <div className="kt-report-audit-head">
        <div>
          <span className="v3-chip kt-report-badge">REFERENCE AUDIT</span>
          <h2>{L("アカウント査定・履歴変化判定", "Account audit / history-change assessment")}</h2>
          <p>{L("過去の高ランク実績に対する現在の苦戦と、初期・直近の主サーバー差を評価します。現在期間の総合評価と、局所的な急変の点数は重ねません。", "Assesses current struggle relative to historical high ranks and initial/current server differences. Current-period and local-event totals are never added together.")}</p>
        </div>
        <AuditCountrySelect
          label={L("出品国籍（参考・加点なし）", "Listed country (context, no points)")}
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
          <AuditBoundary report={report} />
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
                  <ServerLabel cluster={gen.clusterTransition.from} /> → <ServerLabel cluster={gen.clusterTransition.to} />
                  {gen.clusterTransition.date ? ` · ${gen.clusterTransition.date}` : ""}
                </p>
              ) : null}
              {serverStats.knownMatches ? <div className="kt-report-servers">
                {Object.entries(serverStats.clusters).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                  <div className="kt-report-server" key={name}>
                    <div><strong><ServerLabel cluster={name} /></strong><span>{n(count)} / {n(serverStats.percentages[name], 1)}%</span></div>
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
          <AuditTimeline timeline={report.auditTimeline} locale={locale} scoredAt={audit.score === null ? undefined : audit.boundary?.at} />
          <ReportCard title={L("ACT・ランク履歴", "Act / rank history")}
            description={L("ACTピークは参考情報です。ピークだけでは加点しません。", "Act peaks are context only and do not independently add points.")}>
            {report.history.length ? (
              <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("ACT履歴", "Act history")}>
                <table className="kt-report-table">
                  <thead><tr><th>ACT</th><th>{L("ピークランク", "Peak rank")}</th><th>{L("勝敗", "W/L")}</th><th>{L("主サーバー", "Primary server")}</th></tr></thead>
                  <tbody>{report.history.slice(0, 12).map((row) => (
                    <tr key={row.act}>
                      <th scope="row">{formatAct(row.act)}</th>
                      <td><span className="kt-report-rank-cell">
                        {Number.isInteger(row.tier) && row.tier >= 3 && row.tier <= 27
                          ? <Image src={tierIcon(row.tier)} alt="" width={24} height={24} loading="lazy" unoptimized /> : null}
                        {row.tier > 0 ? row.rankName : L("未ランク", "Unranked")}
                      </span></td>
                      <td>{n(row.wins)}-{n(Math.max(0, row.games - row.wins))} ({n(row.winRate)}%)</td>
                      <td>{row.primaryServer ? <ServerLabel cluster={row.primaryServer} /> : "-"}</td>
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
