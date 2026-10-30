import type { Locale } from "./i18n/dict";
import type {
  ActHistoryRow, AuditReport, ClusterEvidence, EarlyRecentComparison,
  LifetimeGenealogy, ReportSignal,
} from "./report-model";
import { MIN_AUDIT_MATCHES } from "./report-evidence.ts";

/** Descriptive change index. No term is an ownership/identity probability. */
export function scoreAudit(input: {
  locale: Locale;
  history: ActHistoryRow[];
  cluster: ClusterEvidence;
  comparison: EarlyRecentComparison;
  genealogy: LifetimeGenealogy;
  transition?: { before: string; after: string; changed: boolean };
}): AuditReport {
  const { locale, history, cluster, comparison: cmp, genealogy: gen } = input;
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
  const enough = gen.totalLifetimeMatches >= MIN_AUDIT_MATCHES;
  const serverChanged = input.transition?.changed ?? gen.hasClusterFlip;
  const signals: ReportSignal[] = [];
  const add = (category: string, severity: ReportSignal["severity"], title: string, description: string) =>
    signals.push({ category, severity, title, description });

  // Episode resets and gaps are not comparable adjacent-act jumps.
  const ordered = [...history].filter((h) => h.tier >= 3 && h.games >= 20)
    .sort((a, b) => actIndex(a.act) - actIndex(b.act));
  const jumps = ordered.filter((cur, i) => {
    const prev = ordered[i - 1];
    return prev && actIndex(cur.act) - actIndex(prev.act) === 1 &&
      Math.abs(cur.tier - prev.tier) >= 5;
  });
  const moved = cmp.comparable ? [
    Math.abs(cmp.kdDiff) >= 0.4, Math.abs(cmp.acsDiff) >= 60, Math.abs(cmp.hsDiff) >= 8,
  ].filter(Boolean).length : 0;
  const performanceScore = moved >= 2 ? (moved === 3 ? 40 : 25) : 0;
  const changedAgents = cmp.comparable && !cmp.before.topAgents.some(([a]) =>
    cmp.after.topAgents.some(([b]) => a === b));
  const breakdown = {
    rankScore: enough ? Math.min(30, jumps.length * 15) : 0,
    performanceScore: enough ? performanceScore : 0,
    serverScore: enough && serverChanged && performanceScore > 0 ? 15 : 0,
    activityScore: enough && changedAgents && performanceScore > 0 ? 15 : 0,
  };
  const score = enough ? Object.values(breakdown).reduce((sum, n) => sum + n, 0) : null;
  const grade = score === null ? null : score >= 70 ? "S" : score >= 45 ? "A" : score >= 20 ? "B" : "C";

  if (!enough) add("sample", "info", L("履歴の標本が不足", "Insufficient recorded history"),
    L(`評価にはCompetitiveの有効な保存試合が${MIN_AUDIT_MATCHES}件以上必要です。`,
      `At least ${MIN_AUDIT_MATCHES} valid stored Competitive matches are required.`));
  else if (!cmp.comparable) add("sample", "info", L("前半・後半の比較は保留", "Period comparison withheld"),
    L("ランク帯の差や欠損データがあるため、実力変化の採点を行いません。",
      "Different rank environments or missing data prevent performance-change scoring."));
  if (jumps.length && enough) add("rank", "warn", L("隣接ACTのランク差", "Rank change between adjacent acts"),
    L(`${jumps.map((h) => h.act.toUpperCase()).join(", ")}で5ティア以上の変化があります。配置・成長でも発生します。`,
      `A change of 5+ tiers was recorded in ${jumps.map((h) => h.act.toUpperCase()).join(", ")}. Placements and improvement can also cause this.`));
  if (performanceScore > 0 && enough) add("performance", "warn", L("複数の成績指標が変化", "Multiple performance metrics changed"),
    L(`比較期間の前後でK/D差 ${cmp.kdDiff}、ACS差 ${cmp.acsDiff}、HS差 ${cmp.hsDiff}pt。成長・役割変更・環境差も要因になります。`,
      `Period differences: K/D ${cmp.kdDiff}, ACS ${cmp.acsDiff}, HS ${cmp.hsDiff}pt. Improvement, role changes and environment also affect these values.`));
  if (serverChanged) add("server", "info", L("利用サーバーの傾向が変化", "Server preference changed"),
    L(`${input.transition?.before ?? gen.earliestCluster}から${input.transition?.after ?? gen.recentCluster}へ。サーバー選択は所在地や所有者を証明しません。`,
      `${input.transition?.before ?? gen.earliestCluster} to ${input.transition?.after ?? gen.recentCluster}. Server choice does not establish location or ownership.`));
  if (gen.isRenamed) add("identity", "info", L("記録上のRiot IDが変更", "Recorded Riot ID changed"),
    `${gen.originalName} → ${gen.currentName}. ${L("改名のみでは加点しません。", "Renaming alone adds no points.")}`);
  if (cluster.knownMatches) add("server", "info", L("利用サーバーの内訳", "Recorded server coverage"),
    L(`サーバー判明 ${cluster.knownMatches}/${gen.totalLifetimeMatches}試合。最多は${cluster.home}。欠損は採点対象外です。`,
      `Server known in ${cluster.knownMatches}/${gen.totalLifetimeMatches} matches. Most frequent: ${cluster.home}. Missing servers add no points.`));
  if (enough && score === 0) add("normal", "normal", L("複合的な変化は未検出", "No combined change markers"),
    L("取得範囲で採点条件に該当する複合変化はありません。本人性・適正プレイの証明ではありません。",
      "No combined changes met the scoring rules in the retrieved history. This does not verify identity or fair play."));

  const title = score === null ? L("判定に必要な履歴が不足", "More history needed")
    : !cmp.comparable ? L("一部の評価を保留", "Partial evaluation only")
    : score >= 45 ? L("履歴に大きな変化あり", "Notable history changes")
    : score >= 20 ? L("一部の履歴に変化あり", "Some history changes")
    : L("大きな変化は未検出", "No major changes detected");
  return {
    score, grade, title,
    confidenceLabel: L("履歴変化の参考指数 / 100（確率ではありません）",
      "History-change index / 100 (not a probability)"),
    recommendation: L("取得済みの履歴を比較します。保存期間はアカウント年齢ではなく、譲渡・共有・代行の事実は判定できません。",
      "Compares retrieved records only. Recorded span is not account age; transfer, sharing and boosting cannot be established."),
    signals, breakdown, comparison: cmp,
    evidence: { cluster, time: cmp }, lifetimeGenealogy: gen,
  };
}

function actIndex(code: string): number {
  const m = code.match(/^e(\d+)a(\d+)$/i);
  return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
}
