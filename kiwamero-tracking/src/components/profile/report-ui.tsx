import type { CSSProperties, ReactNode } from "react";
import { Activity, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { AccountReport, ReportSignal } from "@/lib/report-model";
import type { Locale } from "@/lib/i18n/dict";
import "./report.css";

export const reportText = (locale: Locale) => (ja: string, en: string) => locale === "ja" ? ja : en;
export const reportNumber = (value: number, digits = 0) =>
  Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }) : "-";

export function ReportCard({ title, description, children, className = "" }: {
  title: string; description?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`v3-card kt-report-card ${className}`}>
      <header className="v3-card__header">
        <h2 className="v3-card__title">{title}</h2>
        {description ? <p className="v3-card__description v3-card__description--full">{description}</p> : null}
      </header>
      <div className="v3-card__body kt-report-body">{children}</div>
    </section>
  );
}

export function ReportScope({ report, locale, diagnosis = false }: {
  report: AccountReport; locale: Locale; diagnosis?: boolean;
}) {
  const L = reportText(locale);
  return (
    <div className="kt-report-scope">
      <span className="v3-chip"><Activity size={14} aria-hidden="true" />Competitive</span>
      <span>{diagnosis
        ? L("直近90日・最大25試合", "Last 90 days / up to 25 matches")
        : L("取得済みの全ACT履歴", "All retrieved acts")}</span>
      <span className="kt-report-scope__meta">{diagnosis
        ? `${report.verdict.lobbyAnalysis.sampledMatches} / ${report.sample.rosterMatches} ${L("有効ロスター", "valid rosters")}`
        : `${reportNumber(report.sample.storedMatches)} ${L("保存試合", "stored matches")}`}</span>
    </div>
  );
}

export function ReportRing({ value, label, tone = "good" }: {
  value: number | null; label: string; tone?: string;
}) {
  return (
    <div className="kt-report-ring" data-tone={value === null ? "neutral" : tone}
      style={{ "--report-score": value ?? 0 } as CSSProperties}
      role="img" aria-label={`${label}: ${value === null ? "-" : `${value} / 100`}`}>
      <div><strong>{value === null ? "-" : value}</strong><span>/ 100</span></div>
    </div>
  );
}

export function ReportMeter({ value, max = 100, label, tone = "neutral" }: {
  value: number | null; max?: number; label: string; tone?: string;
}) {
  return (
    <div className="kt-report-meter" data-tone={tone} role="meter"
      aria-label={label} aria-valuemin={0} aria-valuemax={max}
      aria-valuenow={value ?? 0} aria-valuetext={value === null ? "-" : `${value} / ${max}`}>
      <span style={{ width: `${value === null ? 0 : Math.max(0, Math.min(100, value / max * 100))}%` }} />
    </div>
  );
}

export function ReportSignals({ signals, locale }: { signals: ReportSignal[]; locale: Locale }) {
  const L = reportText(locale);
  return (
    <ReportCard title={L("分析メモ", "Analysis notes")} description={L("観測できた事実と解釈の限界", "Observed evidence and its limits")}>
      <ul className="kt-report-signals">
        {signals.map((signal, i) => {
          const Icon = signal.severity === "normal" ? CheckCircle2
            : signal.severity === "warn" || signal.severity === "alert" ? TriangleAlert : Info;
          return (
            <li key={`${signal.category}-${i}`} data-tone={signal.severity === "normal" ? "good" : signal.severity === "warn" ? "warn" : "neutral"}>
              <Icon size={18} aria-hidden="true" />
              <div><h3>{signal.title}</h3><p>{signal.description}</p></div>
            </li>
          );
        })}
      </ul>
    </ReportCard>
  );
}

export function ReportMethod({ locale, diagnosis = false }: { locale: Locale; diagnosis?: boolean }) {
  const L = reportText(locale);
  return (
    <details className="kt-report-method">
      <summary>{L("計算方法とデータの限界", "Methodology & data limitations")}</summary>
        <div>
        {diagnosis ? (
          <>
            <p>{L("直近90日以内のCompetitiveロスターを重複排除し、最大25試合で分析。PUUIDで本人を照合します。完全な10人・有効なチーム/ラウンド/射撃データが必要です。最低10試合・決着5試合未満なら採点しません。",
              "Uses up to 25 deduplicated Competitive rosters within 90 days, matching the owner by PUUID. Requires 10 players and valid team, round and shot data. Scores need 10 matches and 5 decided games.")}</p>
            <p>{L("モデル偏差 = (実測値 − 仮定平均) / max((仮定上限 − 仮定平均) / 1.645, 下限幅)。勝率偏差 = (勝率 − 50) / 25。引き分けは勝率から除外。ロールは同じ標本から集計します。",
              "Model deviation = (observed - assumed mean) / max((assumed upper marker - mean) / 1.645, floor). WR deviation = (WR - 50) / 25. Draws are excluded from WR; role is derived from the same sample.")}</p>
            <p>{L("各ロビー帯の参考ティア = 平均ロビー + [-1.5, 1.5]に制限した平均偏差 / 0.3。これを試合数で加重平均。モデル幅 = 2 + 3 / √試合数。参考ランクは3〜27に制限。確率・信頼区間ではありません。",
              "Each lobby band's reference tier = mean lobby tier + mean deviation capped to [-1.5, 1.5] / 0.3, then weighted by match count. Model spread = 2 + 3 / sqrt(matches). Tiers are bounded to 3-27. Not a probability or confidence interval.")}</p>
            <p>{L("ランク差指数は3ティア以上の差かつ戦闘偏差0.5以上で加点。サブ垢参考値は既知のLv.80未満かつ3ティア差・戦闘偏差0.75以上が必要。外れ値指数は2指標以上の偏差2以上で計算します。不正を検出する機能ではありません。",
              "Rank-gap scoring requires a 3+ tier gap and combat deviation >=0.5. Alt indicators also require a known level below 80 and combat deviation >=0.75. Outlier scoring requires 2+ metrics at deviation >=2. This is not cheat detection.")}</p>
            <p>{L("採点条件を満たす場合、ランク差指数 = 12×(ティア差−2) + 25×max(0, 総合偏差) + (勝率60%以上なら15)。サブ垢参考値 = ランク差指数×0.6 + 20。外れ値指数 = Σ max(0, 各指標偏差−1.5)×20。各指数は0〜100に制限します。",
              "When eligible: rank mismatch = 12*(tier gap-2) + 25*max(0, composite deviation) + 15 if WR >=60%. Alt index = rank mismatch*0.6 + 20. Outlier index = sum(max(0, metric deviation-1.5)*20). Each is bounded to 0-100.")}</p>
          </>
        ) : (
          <p>{L("40試合以上で採点。全履歴の各境界を前後20試合で比較し、重複候補をまとめ最大5件を表示。成績部分は最大変化点を使い、候補がなければ全履歴の前半/後半を比較します。ランク変化は全履歴で15点/件（上限30、同一Episodeの隣接ACT・各20試合以上・5ティア差）。比較窓の各80%以上でランクが判明し、各窓内の幅が4ティア以下・平均差が2以内でK/D差0.4・ACS差60・HS差8ptのうち2つ以上なら25点、3つなら40点。成績変化と重なるサーバー変化・主使用変更は各15点。活動時間・パートナー・改名・欠損・サーバー変更単独は加点しません。",
            "Requires 40 matches. Compare 20 games on each side of every boundary; consolidate up to 5 candidates. Performance uses the strongest change, otherwise chronological halves. Whole-history rank changes: 15 each (cap 30; adjacent acts in one episode, 20+ games each, 5+ tiers). Performance: 25 for 2 of K/D 0.4, ACS 60, HS 8pt changes; 40 for all 3, with >=80% known ranks, within-window tier span <=4 and mean tiers within 2. Correlated server/agent changes add 15 each. Hours, partners, renames, missing data and server changes alone add nothing.")}</p>
        )}
        <p>{L("ベンチマークは独自の仮定定数で、tracker.ggの母集団統計ではありません。保存履歴は生涯全試合やアカウント作成日を保証しません。自動分析だけで人物・譲渡・不正の有無を判断しないでください。",
          "Benchmarks are heuristic constants, not tracker.gg population statistics. Retrieved history does not guarantee lifetime coverage or creation date. Do not infer identity, ownership or cheating from this analysis alone.")}</p>
      </div>
    </details>
  );
}
