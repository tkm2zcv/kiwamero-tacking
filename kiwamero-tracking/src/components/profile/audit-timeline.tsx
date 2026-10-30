import type { AuditTimeline as Timeline } from "@/lib/audit-timeline";
import type { Locale } from "@/lib/i18n/dict";
import { ReportCard, reportNumber as n, reportText } from "./report-ui";

export function AuditTimeline({ timeline, locale }: { timeline: Timeline; locale: Locale }) {
  const L = reportText(locale);
  const date = (at: number) => new Date(at * 1000).toISOString().slice(0, 10);
  return (
    <ReportCard title={L("時系列の変化点候補", "Historical change-point candidates")}
      description={L(`各境界の前後${timeline.windowSize}試合を比較。${timeline.windowsScanned}窓中${timeline.comparableWindows}窓が比較可能。`,
        `Compared ${timeline.windowSize} matches on each side of every boundary; ${timeline.comparableWindows}/${timeline.windowsScanned} windows comparable.`)}>
      {timeline.candidates.length ? <div className="kt-report-table-wrap" tabIndex={0} role="region"
        aria-label={L("変化点候補の比較", "Change-point comparison")}>
        <table className="kt-report-table">
          <thead><tr><th>{L("変化点 / 対象期間", "Boundary / window")}</th><th>K/D Δ</th><th>ACS Δ</th><th>HS Δ</th>
            <th>{L("併発する変化", "Context")}</th><th>{L("前 / 後のロスター", "Rosters before / after")}</th></tr></thead>
          <tbody>{timeline.candidates.map((c) => <tr key={`${c.at}-${c.from}`}>
            <th scope="row">{date(c.at)}<small>{date(c.from)} - {date(c.to)}</small></th>
            <td>{n(c.comparison.kdDiff, 2)}</td><td>{n(c.comparison.acsDiff)}</td><td>{n(c.comparison.hsDiff, 1)}pt</td>
            <td className="kt-report-cell-note">
              {[c.server.changed && L("サーバー", "Server"), c.agentChanged && L("エージェント", "Agent"),
                c.hoursChanged && L("活動時間帯（UTC）", "Play hours (UTC)")].filter(Boolean).join(" / ") || "-"}
              <small>{c.partyOverlap === null ? L("パーティー継続性: データ不足", "Party continuity: insufficient data")
                : L(`反復パートナーの共通率 ${n(c.partyOverlap * 100)}%`, `Repeat-partner overlap ${n(c.partyOverlap * 100)}%`)}</small>
            </td>
            <td>{c.rosterBefore}/{timeline.windowSize} · {c.rosterAfter}/{timeline.windowSize}</td>
          </tr>)}</tbody>
        </table>
      </div> : <p className="kt-report-empty">{timeline.comparableWindows
        ? L("比較できた窓では複数指標が同時に変わる候補は未検出。未補完の情報は未評価です。",
          "No multi-metric change candidates in comparable windows. Unenriched information remains unexamined.")
        : L("比較可能な窓がありません。標本不足や異なるランク帯を正常と判定しません。",
          "No comparable windows. Sparse or different-rank periods are not classified as normal.")}</p>}
      <p className="kt-report-footnote">{L("近接する候補をまとめ、最大5件を表示。活動時間帯はサーバー所在地を意味しません。変化点やパートナーの変化は所有者変更の証拠ではありません。",
        "Nearby candidates are consolidated; up to 5 are shown. UTC activity is not location. Changes or partner turnover do not prove an ownership change.")}</p>
    </ReportCard>
  );
}
