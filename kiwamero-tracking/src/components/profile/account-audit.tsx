import Image from "next/image";
import { getDict, getLocale } from "@/lib/i18n/server";
import { formatAct } from "@/lib/profile-stats";
import { tierIcon } from "@/lib/henrikdev";
import type { Profile, Summary } from "@/lib/types";
import type { AccountReport } from "@/lib/report-model";

const GRADE_COLOR: Record<string, string> = {
  S: "#f87171", A: "#fb923c", B: "#fbbf24", C: "#34d399",
};
const SEVERITY_COLOR: Record<string, string> = {
  alert: "#f87171", warn: "#fbbf24", info: "#38bdf8", normal: "#34d399",
};

/**
 * Account Audit (アカウント査定) — appraises how strongly the account history
 * suggests the person behind it changed, with the evidence shown alongside.
 */
export async function AccountAudit({
  profile,
  summary,
  capturedAt,
  report,
}: {
  profile: Profile;
  summary: Summary;
  capturedAt: string;
  report: AccountReport;
}) {
  const t = await getDict();
  const locale = await getLocale();
  const { audit } = report;
  const gen = audit.lifetimeGenealogy;
  const firstAct = report.history[report.history.length - 1];
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);

  const facts: { label: string; value: React.ReactNode }[] = [
    { label: "Account Level", value: profile.level || "—" },
    { label: "Region", value: profile.region?.toUpperCase() || "—" },
    { label: "Current Rating", value: profile.currentRank || "—" },
    { label: "Rank Rating", value: profile.rr != null ? `${profile.rr} RR` : "—" },
    { label: "Peak Rating", value: profile.peakRank ? `${profile.peakRank}${profile.peakAct ? ` (${formatAct(profile.peakAct)})` : ""}` : "—" },
    { label: "First Act Seen", value: firstAct ? formatAct(firstAct.act) : "—" },
    { label: L("保存試合数", "Stored Matches"), value: gen.totalLifetimeMatches },
    { label: L("記録期間", "Recorded Span"), value: gen.lifetimeSpanMonths ? `${gen.oldestMatchDate} → ${gen.newestMatchDate} (${gen.lifetimeSpanMonths}mo)` : "—" },
    { label: L("直近の勝率", "Recent Win Rate"), value: summary.matches ? `${summary.winRate.toFixed(1)}%` : "—" },
    { label: L("直近のK/D", "Recent K/D"), value: summary.matches ? summary.kd.toFixed(2) : "—" },
    { label: "Last Updated", value: profile.lastUpdated || new Date(capturedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) },
  ];

  return (
    <div className="space-y-3">
      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{t.diagnosis.accountAudit}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-4 text-3xl font-black"
              style={{ background: `${GRADE_COLOR[audit.grade]}22`, color: GRADE_COLOR[audit.grade], border: `1px solid ${GRADE_COLOR[audit.grade]}55` }}>
              {audit.grade}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-bold">{audit.title}</div>
              <div className="mt-0.5 text-12 text-secondary">{audit.confidenceLabel}</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width: `${audit.score}%`, background: GRADE_COLOR[audit.grade] }} />
              </div>
            </div>
            <div className="shrink-0 text-2xl font-black" style={{ color: GRADE_COLOR[audit.grade] }}>{audit.score}</div>
          </div>
          <p className="mt-3 text-13 text-secondary">{audit.recommendation}</p>
          <p className="mt-1 text-11 text-tertiary">
            {L("推定は公開データの統計的参考値であり、断定ではありません。", "Heuristic reference from public data — not a definitive judgement.")}
          </p>
        </div>
      </div>

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{L("内訳スコア", "Score breakdown")}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 grid gap-y-px rounded-4 overflow-hidden">
          {([
            [L("ランク推移", "Rank trajectory"), audit.breakdown.rankScore, 45],
            [L("サーバー環境", "Server environment"), audit.breakdown.serverScore, 45],
            [L("実力推移", "Performance shift"), audit.breakdown.performanceScore, 40],
            [L("アカウント経歴", "Account history"), audit.breakdown.activityScore, 40],
          ] as const).map(([label, v, max]) => (
            <div key={label} className="row relative flex min-h-12 items-center bg-[--row-color] px-4">
              <span className="w-40 text-12 text-secondary">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: v ? "#fbbf24" : "#34d399" }} />
              </div>
              <span className="w-12 text-right font-bold">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <AuditEvidence report={report} locale={locale} />

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{L("検出シグナル", "Detected signals")}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 space-y-2 p-4">
          {audit.signals.map((s, i) => (
            <div key={i} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: SEVERITY_COLOR[s.severity] ?? "#9ca3af" }} />
              <div>
                <div className="text-13 font-semibold">{s.title}</div>
                <p className="text-12 text-secondary">{s.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{L("アカウント実績", "Account facts")}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5">
          <div className="grid gap-y-px rounded-4 overflow-hidden">
            <div className="row relative flex min-h-14 bg-[--row-color] items-center">
              <div className="relative flex items-center px-4 bg-inherit">
                <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate val v3-stat-left">
                  {profile.currentTier ? (
                    <Image className="image rounded-2 object-contain" src={tierIcon(profile.currentTier, "small")} alt="" width={120} height={120} unoptimized />
                  ) : null}
                  <div className="name-value flex gap-x-space flex-col truncate">
                    <span className="stat-value inline-flex gap-0.5 value truncate"><span className="truncate">{profile.currentRank || "—"}</span></span>
                    {profile.rankPosition ? (
                      <div className="substats flex text-10 leading-4/4 text-secondary mt-1"><span className="text-gold">#{profile.rankPosition.toLocaleString("en-US")}</span></div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            {facts.map((r) => (
              <div key={r.label} className="row relative flex min-h-14 bg-[--row-color] items-center">
                <div className="relative flex items-center px-4 bg-inherit">
                  <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate val v3-stat-left">
                    <div className="name-value flex gap-x-space flex-col truncate">
                      <span className="stat-value inline-flex gap-0.5 value truncate"><span className="truncate">{r.value}</span></span>
                      <div className="substats flex text-10 leading-4/4 text-secondary mt-1"><span>{r.label}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuditEvidence({ report, locale }: { report: AccountReport; locale: "en" | "ja" }) {
  const cmp = report.comparison;
  const gen = report.lifetimeGenealogy;
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);
  const row = (label: string, a: string, b: string) => (
    <div key={label} className="row relative flex min-h-11 items-center bg-[--row-color] px-4 text-13">
      <span className="w-36 text-secondary">{label}</span>
      <span className="flex-1">{a}</span>
      <span className="flex-1">{b}</span>
    </div>
  );
  return (
    <div className="v3-card">
      <header className="v3-card__header"><h2 className="v3-card__title">{L("エビデンス", "Evidence")}</h2></header>
      <div className="v3-card__body v3-card__body--v2.5 grid gap-y-px rounded-4 overflow-hidden">
        <div className="row relative flex min-h-9 items-center bg-[--row-color] px-4 text-11 font-bold uppercase tracking-wider text-tertiary">
          <span className="w-36">{L("前半 vs 後半", "Early vs recent")}</span>
          <span className="flex-1">{L("前半", "First half")} ({cmp.before.count})</span>
          <span className="flex-1">{L("後半", "Second half")} ({cmp.after.count})</span>
        </div>
        {row("K/D", cmp.before.kd.toFixed(2), cmp.after.kd.toFixed(2))}
        {row("ACS", String(Math.round(cmp.before.acs)), String(Math.round(cmp.after.acs)))}
        {row("HS%", `${cmp.before.hsRate.toFixed(1)}%`, `${cmp.after.hsRate.toFixed(1)}%`)}
        {row(L("勝率", "Win rate"), `${cmp.before.winRate.toFixed(1)}%`, `${cmp.after.winRate.toFixed(1)}%`)}
        {row(L("主使用", "Top agents"), cmp.before.topAgents.map(([a]) => a).join(", ") || "—", cmp.after.topAgents.map(([a]) => a).join(", ") || "—")}
        <div className="row relative flex min-h-11 items-center bg-[--row-color] px-4 text-13">
          <span className="w-36 text-secondary">{L("サーバー", "Servers")}</span>
          <span className="flex-1">
            {Object.entries(report.serverStats.clusters).map(([name, n]) => (
              <span key={name} className="mr-2 inline-block rounded-2 bg-white/6 px-2 py-0.5 text-12">{name} {Math.round((n / (report.serverStats.total || 1)) * 100)}%</span>
            ))}
            {gen.hasClusterFlip ? <span className="text-12" style={{ color: "#f87171" }}>{L("移動あり", "relocated")}</span> : null}
          </span>
        </div>
        {row(L("Riot ID", "Riot ID"), gen.originalName, gen.isRenamed ? gen.currentName : L("変更なし", "unchanged"))}
      </div>
    </div>
  );
}
