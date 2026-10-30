import Image from "next/image";
import { getDict, getLocale } from "@/lib/i18n/server";
import { tierIcon } from "@/lib/henrikdev";
import type { AccountReport } from "@/lib/report-model";
import { DiagnosisLobby } from "./diagnosis-lobby";

const VERDICT_COLOR: Record<string, string> = {
  emerald: "#34d399", amber: "#fbbf24", sky: "#38bdf8",
  red: "#f87171", violet: "#a78bfa", gray: "#9ca3af",
};
const SEVERITY_COLOR: Record<string, string> = {
  alert: "#f87171", warn: "#fbbf24", info: "#38bdf8", normal: "#34d399",
};

/** スマーフ診断 — verdict, true-rank estimate, benchmarks and lobby evidence. */
export async function DiagnosisPanel({ report }: { report: AccountReport }) {
  const t = await getDict();
  const locale = await getLocale();
  const v = report.verdict;
  const est = v.estimatedTrueRank;
  const color = VERDICT_COLOR[v.verdict.color] ?? "#9ca3af";
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);
  const scores: [string, number, string][] = [
    [t.diagnosis.score, v.scores.smurfScore, "#fbbf24"],
    [L("サブ垢スコア", "Alt Score"), v.scores.altScore, "#38bdf8"],
    [L("チートスコア", "Cheat Score"), v.scores.cheatScore, "#f87171"],
  ];
  const topProb = Object.entries(est.probabilities)
    .map(([tier, p]) => ({ tier: +tier, p }))
    .filter((x) => x.p >= 0.005)
    .sort((a, b) => b.p - a.p)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{t.diagnosis.title}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 p-4">
          <div className="flex items-center gap-3">
            <span className="rounded-3 px-3 py-1.5 text-15 font-black" style={{ background: `${color}22`, color, border: `1px solid ${color}55` }}>
              {v.verdict.label}
            </span>
            <span className="text-13 text-secondary">{v.verdict.sublabel}</span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {scores.map(([label, value, c]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-11 text-tertiary">
                  <span>{label}</span><span className="font-bold" style={{ color: c }}>{value}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full" style={{ width: `${value}%`, background: c }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-11 text-tertiary">
            {L(
              `標本: 保存試合 ${report.sample.storedMatches}・ロスター取得 ${report.sample.rosterMatches}・ロビー有効 ${v.lobbyAnalysis.sampledMatches}。スコアは統計的な参考値で、個人の断定には使えません。`,
              `Sample: ${report.sample.storedMatches} stored · ${report.sample.rosterMatches} rosters · ${v.lobbyAnalysis.sampledMatches} lobby-valid. Scores are statistical references, not verdicts on a person.`)}
          </p>
        </div>
      </div>

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{L("推定実力ランク", "Estimated true rank")}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 p-4">
          <div className="flex items-center gap-4">
            {est.tier ? (
              <Image src={tierIcon(est.tier, "small")} alt="" width={64} height={64} unoptimized />
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-18 font-black">{est.tierName}</span>
                {est.tierGap !== 0 ? (
                  <span className="text-13 font-bold" style={{ color: est.tierGap > 0 ? "#fbbf24" : "#38bdf8" }}>
                    {est.tierGap > 0 ? `+${est.tierGap}` : est.tierGap} {L("ティア差", "tier gap")}
                  </span>
                ) : null}
              </div>
              <div className="mt-1 text-12 text-secondary">
                {`${L("90%信頼区間", "90% CI")}: ${est.confidenceInterval90.spanText} · ${L("信頼度", "confidence")}: ${est.confidence}`}
              </div>
            </div>
          </div>
          {topProb.length ? (
            <div className="mt-4 space-y-1.5">
              {topProb.map((x) => (
                <div key={x.tier} className="flex items-center gap-2 text-12">
                  <Image src={tierIcon(x.tier, "small")} alt="" width={18} height={18} unoptimized />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/8">
                    <div className="h-full rounded-full bg-white/50" style={{ width: `${x.p * 100}%` }} />
                  </div>
                  <span className="w-12 text-right text-secondary">{(x.p * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <DiagnosisLobby report={report} locale={locale} />

      <div className="v3-card">
        <header className="v3-card__header"><h2 className="v3-card__title">{t.diagnosis.signals}</h2></header>
        <div className="v3-card__body v3-card__body--v2.5 space-y-2 p-4">
          {v.signals.map((s, i) => (
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
    </div>
  );
}
