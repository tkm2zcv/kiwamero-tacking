"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuditCoverage } from "@/lib/audit-coverage";
import type { Locale } from "@/lib/i18n/dict";
import { ReportCard, ReportMeter, reportText, reportNumber as n } from "./report-ui";

export function AuditProgress({ initial, puuid, name, tag, locale, availableMatches }: {
  initial?: AuditCoverage; puuid: string; name: string; tag: string; locale: Locale;
  availableMatches: number;
}) {
  const L = reportText(locale);
  const router = useRouter();
  const [coverage, setCoverage] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const refreshed = useRef(initial?.cached ?? 0);
  const url = `/api/valorant/audit/${encodeURIComponent(puuid)}`;
  useEffect(() => {
    if (coverage?.state !== "pending") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const poll = async () => {
      try {
        const res = await fetch(url, { cache: "no-store", signal: controller.signal });
        if (!res.ok) throw new Error("unavailable");
        const next = await res.json() as AuditCoverage;
        if (stopped) return;
        setCoverage(next);
        setFailed(false);
        if (next.cached >= refreshed.current + 20 || next.state !== "pending") {
          refreshed.current = next.cached;
          router.refresh();
        }
        if (next.state !== "pending") return;
      } catch {
        if (stopped) return;
        setFailed(true);
      }
      timer = setTimeout(poll, 15_000);
    };
    timer = setTimeout(poll, 15_000);
    return () => { stopped = true; clearTimeout(timer); controller.abort(); };
  }, [coverage?.state, router, url]);

  async function start() {
    setBusy(true); setFailed(false);
    try {
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tag }),
      });
      if (!res.ok) throw new Error("unavailable");
      setCoverage(await res.json() as AuditCoverage);
      router.refresh();
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }
  const idle = !coverage || coverage.state === "idle";
  const total = idle ? availableMatches : coverage.total;
  return (
    <ReportCard title={L("全期間の詳細補完", "Historical detail coverage")}
      description={L("取得できた保存履歴が対象です。生涯全試合の取得を保証するものではありません。",
        "Covers retrieved stored history, not guaranteed lifetime coverage.")}>
      <div className="kt-report-pad kt-audit-progress">
        <div className="kt-audit-progress__head">
          <strong>{!coverage ? L("保存先へ接続できません", "Analysis storage unavailable")
            : idle ? L("未開始", "Not started") : coverage.state === "pending"
            ? L("補完中・暫定評価", "In progress / provisional")
            : coverage.state === "partial" ? L("取得不能な試合あり", "Some matches unavailable")
            : L("保存履歴の補完完了", "Stored-history enrichment complete")}</strong>
          <button className="kt-btn kt-btn--secondary" disabled={busy} onClick={start}>
            {busy ? L("登録中...", "Submitting...") : idle ? L("詳細補完を開始", "Start enrichment")
              : L("履歴を再同期", "Sync history")}
          </button>
        </div>
        <p role="status" aria-live="polite">{idle ? "-" : n(coverage.cached)} / {n(total)} {L("試合のロスター保存済み", "match rosters archived")}</p>
        <ReportMeter value={!idle && total ? coverage.cached / total * 100 : null}
          label={L("ロスター補完率", "Roster coverage")} />
        <p>{L("未補完", "Pending")}: {idle ? "-" : n(coverage.pending)} · {L("取得不能", "Unavailable")}: {idle ? "-" : n(coverage.unavailable)}</p>
        {failed && <p role="alert">{L("処理を確認できません。混雑・利用枠・保存先設定を確認して再試行してください。",
          "Could not confirm progress. Check capacity, quota or storage configuration and retry.")}</p>}
      </div>
      {coverage?.periods?.length ? <details className="kt-report-method">
        <summary>{L("期間別の補完状況", "Coverage by period")} ({coverage.periods.length})</summary>
        <div className="kt-report-table-wrap" tabIndex={0} role="region" aria-label={L("未補完の期間", "Unexamined periods")}>
          <table className="kt-report-table">
            <thead><tr><th>{L("ACT / 取得期間", "Act / recorded window")}</th><th>{L("保存済み", "Archived")}</th>
              <th>{L("未補完", "Pending")}</th><th>{L("取得不能", "Unavailable")}</th></tr></thead>
            <tbody>{coverage.periods.map((p) => <tr key={p.period}>
              <th scope="row">{p.period.toUpperCase()}<small>
                {new Date(p.from * 1000).toISOString().slice(0, 10)} - {new Date(p.to * 1000).toISOString().slice(0, 10)}
              </small></th>
              <td>{n(p.cached)} / {n(p.total)}</td><td>{n(p.total - p.cached - p.unavailable)}</td><td>{n(p.unavailable)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </details> : null}
      <p className="kt-report-footnote">{L("変化点の前後を優先し、その後に全期間を補完します。キーごとの枠は検索・監視と共有。未取得を「変化なし」とは扱いません。",
        "Change-point windows are prioritized, then the remaining history. Quotas are shared with search/watch. Unexamined matches are not evidence of no change.")}</p>
    </ReportCard>
  );
}
