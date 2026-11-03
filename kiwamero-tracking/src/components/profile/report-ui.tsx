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
            <li key={`${signal.category}-${i}`} data-tone={signal.severity === "normal" ? "good" : signal.severity === "warn" ? "warn" : signal.severity === "alert" ? "danger" : "neutral"}>
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
            <p>{L("モデル信頼度は標本数だけの表示です。有効ロスター15試合以上で「高」、決着5試合以上で「中」、それ未満は「低」。測定精度や的中率ではありません。",
              "Model confidence is a sample-size label only: high with 15+ valid rosters, moderate with 5+ decided matches, otherwise low. It is not measured accuracy or correctness.")}</p>
            <p>{L("ランク差指数は3ティア以上の差かつ戦闘偏差0.5以上で加点。サブ垢参考値は既知のLv.80未満かつ3ティア差・戦闘偏差0.75以上が必要。外れ値指数は2指標以上の偏差2以上で計算します。不正を検出する機能ではありません。",
              "Rank-gap scoring requires a 3+ tier gap and combat deviation >=0.5. Alt indicators also require a known level below 80 and combat deviation >=0.75. Outlier scoring requires 2+ metrics at deviation >=2. This is not cheat detection.")}</p>
            <p>{L("採点条件を満たす場合、ランク差指数 = 12×(ティア差−2) + 25×max(0, 総合偏差) + (勝率60%以上なら15)。サブ垢参考値 = ランク差指数×0.6 + 20。外れ値指数 = Σ max(0, 各指標偏差−1.5)×20。各指数は0〜100に制限します。",
              "When eligible: rank mismatch = 12*(tier gap-2) + 25*max(0, composite deviation) + 15 if WR >=60%. Alt index = rank mismatch*0.6 + 20. Outlier index = sum(max(0, metric deviation-1.5)*20). Each is bounded to 0-100.")}</p>
          </>
        ) : (
          <>
            <p>{L("Competitiveの前後20試合を比較し、各期間を10試合ずつにも分割。本人ランクの有効率80%以上・期間内の幅4ティア以内が必要です。低下は低い本人ランクへ移った場合も評価し、2ティア超のランク上昇による成績悪化は保留。K/D上昇の評価は平均ランク差2以内に限ります。比較可能な窓がなければCではなく評価保留です。",
              "Compares 20 Competitive matches per side, also split into 10-match halves. Requires 80% valid owner ranks and a spread of <=4 tiers per period. Declines can cross to lower ranks; >2-tier increases are withheld. K/D rises require a mean-rank gap <=2. No eligible windows means withheld, not grade C.")}</p>
            <p>{L("K/D差0.4以上、前後それぞれ14/20試合で反対期間の集計K/Dから同方向に0.2以上離れ、後の両10試合でも以前との差0.3以上が必要。期間差が各期間内の半窓差（最低0.05）の2.5倍を超えた場合だけ急変とします。前K/D0.9以上→後0.8以下・後の両半窓0.85以下を継続低K/Dとして55点、それ以外の持続的K/D変化は25点。HS%・ACSは必須にせず、重複加点しません。",
              "Requires a K/D delta >=0.4, with 14/20 matches on each side differing directionally by >=0.2 from the opposite aggregate, and both following halves differing by >=0.3 from the prior aggregate. The delta must exceed 2.5 times within-period half-window drift (floor 0.05). Prior K/D >=0.9 to following <=0.8, with both following halves <=0.85, adds 55; other sustained K/D changes add 25. HS%/ACS are not prerequisites or duplicate points.")}</p>
            <p>{L("同じ境界だけを採点。継続低K/D時に本人平均ランクが3/6ティア以上低下なら10/20点。主サーバーが前後各20試合の80%以上で別サーバーへ移行なら単独10点・K/D変化と同じ境界なら20点。UTC時間帯分布の差が0.6以上ならK/D変化に5点を追加。ロール変更は戦闘項目から10点減点。境界の記録間隔30日以上は各項目を半減・四捨五入。ACTピーク・改名・選択国籍は加点しません。",
              "Only one boundary is scored. Persistent low K/D plus a 3/6-tier owner-rank drop adds 10/20. Different servers dominating >=80% of each window add 10 alone or 20 at a K/D boundary. A UTC-hour distribution difference >=0.6 adds 5 to a K/D event. A role change subtracts 10 combat points. Recording gaps >=30 days halve each contribution, rounded. Act peaks, renames and selected country add no points.")}</p>
            <p>{L("近接候補を統合した最大5件から、単一境界の合計が最大のものを選びます。総合上限100点、S=70以上・A=45以上・B=25以上・C=25未満。閾値・配点は未校正の運用ルールです。対戦相手・マップ・パーティ・休止の影響を完全には除けず、本人交代や居住国の変更を証明しません。",
              "Up to five consolidated candidates are considered; the largest single-boundary total is selected. Cap 100; S>=70, A>=45, B>=25, C<25. Thresholds and points are uncalibrated policy rules. Opponent, map, party and inactivity effects cannot be fully isolated; identity or physical-country changes are not established.")}</p>
          </>
        )}
        <p>{L("ベンチマークは独自の仮定定数で、tracker.ggの母集団統計ではありません。保存履歴は生涯全試合やアカウント作成日を保証しません。自動分析だけで人物・譲渡・不正の有無を判断しないでください。",
          "Benchmarks are heuristic constants, not tracker.gg population statistics. Retrieved history does not guarantee lifetime coverage or creation date. Do not infer identity, ownership or cheating from this analysis alone.")}</p>
      </div>
    </details>
  );
}
