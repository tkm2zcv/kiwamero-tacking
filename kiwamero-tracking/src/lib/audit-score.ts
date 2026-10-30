/**
 * アカウント査定 — scores how strongly the account's history suggests the
 * person behind it changed (sold/shared/boosted) versus natural self-play.
 * Score is a heuristic reference, not an accusation; every fired signal is
 * listed with its evidence so users can judge.
 */
import type { Locale } from "./i18n/dict";
import type {
  ActHistoryRow, AuditBreakdown, AuditReport, ClusterEvidence,
  EarlyRecentComparison, LifetimeGenealogy, ReportSignal,
} from "./report-model";

const L = (locale: Locale, ja: string, en: string) => (locale === "ja" ? ja : en);

/** Sudden one-act tier leaps on thin game counts — a classic flip marker. */
function rankJumpScore(history: ActHistoryRow[]): { score: number; jumps: ActHistoryRow[] } {
  const ordered = [...history].filter((h) => h.games > 0 && h.tier > 0)
    .sort((a, b) => actIdx(a.act) - actIdx(b.act));
  const jumps: ActHistoryRow[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    if (Math.abs(cur.tier - prev.tier) >= 5 && Math.min(prev.games, cur.games) <= 60) {
      jumps.push(cur);
    }
  }
  return { score: Math.min(45, jumps.length * 18), jumps };
}

function actIdx(code: string): number {
  const m = code.toLowerCase().match(/^e(\d+)a(\d+)$/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
}

export function scoreAudit(input: {
  locale: Locale;
  history: ActHistoryRow[];
  cluster: ClusterEvidence;
  comparison: EarlyRecentComparison;
  genealogy: LifetimeGenealogy;
  currentTier: number;
}): AuditReport {
  const { locale, history, cluster, comparison, genealogy, currentTier } = input;
  const { score: rankScore, jumps } = rankJumpScore(history);

  const total = genealogy.totalLifetimeMatches || 1;
  const homeShare = (cluster.homeMatchCount ?? 0) / total;
  const serverScore = Math.min(45,
    (homeShare >= 0.95 ? 0 : homeShare >= 0.8 ? 10 : homeShare >= 0.6 ? 20 : 30) +
    (genealogy.hasClusterFlip ? 25 : 0));

  const disjointAgents =
    comparison.before.topAgents.length > 0 && comparison.after.topAgents.length > 0 &&
    !comparison.before.topAgents.some(([a]) =>
      comparison.after.topAgents.some(([b]) => b === a));
  const movedMetrics =
    (Math.abs(comparison.kdDiff) >= 0.4 ? 1 : 0) +
    (Math.abs(comparison.acsDiff) >= 60 ? 1 : 0) +
    (Math.abs(comparison.hsDiff) >= 8 ? 1 : 0);
  const performanceScore = Math.min(40,
    (comparison.hasTransition ? 20 : 0) + (movedMetrics >= 2 ? 10 : 0) + (disjointAgents ? 10 : 0));

  const activityScore = Math.min(40,
    (genealogy.lifetimeSpanMonths > 0 && genealogy.lifetimeSpanMonths < 2 && currentTier >= 21 ? 20 : 0) +
    (total < 100 && currentTier >= 21 ? 15 : 0) +
    (genealogy.isRenamed ? 10 : 0));

  const breakdown: AuditBreakdown = { rankScore, serverScore, performanceScore, activityScore };
  const score = Math.min(100, rankScore + serverScore + performanceScore + activityScore);
  const grade = score >= 70 ? "S" : score >= 45 ? "A" : score >= 20 ? "B" : "C";
  const fired = [rankScore, serverScore, performanceScore, activityScore].filter((s) => s > 0).length;

  const signals = buildSignals({
    locale, history, jumps, homeShare, clusterName: cluster.home,
    comparison, genealogy, disjointAgents, score, currentTier,
  });

  const title =
    score >= 70 ? L(locale, "中身変更シグナル: 強い (要確認)", "Ownership-change signals: strong (review advised)")
    : score >= 45 ? L(locale, "中身変更シグナル: 中程度", "Ownership-change signals: moderate")
    : score >= 20 ? L(locale, "中身変更シグナル: 弱め", "Ownership-change signals: weak")
    : L(locale, "中身変更シグナル: ほぼなし (通常アカウント)", "Ownership-change signals: almost none (normal account)");
  const confidenceLabel = L(locale,
    `中身変更確度: ${score}% (${score >= 45 ? "高" : score >= 20 ? "中" : "低"})`,
    `Ownership-change likelihood: ${score}% (${score >= 45 ? "high" : score >= 20 ? "medium" : "low"})`);
  const recommendation =
    score >= 70 ? L(locale,
      "サーバー移動・実力断絶・ランク跳躍など複数の交代兆候が重なっています。共有・譲渡・代行の可能性が高く、詳細な確認を推奨します。",
      "Multiple handover markers overlap (server move, skill discontinuity, rank jumps). Sharing, transfer or boosting is likely — review carefully.")
    : score >= 45 ? L(locale,
      "いくつかの交代兆候が見られます。断定はできませんが、利用前に履歴を確認することをおすすめします。",
      "Some handover markers are present. Not conclusive, but worth reviewing the history before relying on this account.")
    : score >= 20 ? L(locale,
      "軽い兆候のみで、通常プレイの範囲とも取れます。大きな懸念材料は見つかっていません。",
      "Only mild markers, still within the range of normal play. No major concerns detected.")
    : L(locale,
      "明確な中身交代の証拠は検知されず、本人が自力でプレイしている正規アカウントの可能性が高いです。",
      "No clear evidence of an ownership change — most likely a genuine self-played account.");

  return {
    score, grade, title, confidenceLabel, recommendation, signals, breakdown,
    comparison, evidence: { cluster, time: comparison }, lifetimeGenealogy: genealogy,
    originFraud: score >= 45 && fired >= 2 &&
      (genealogy.hasClusterFlip || genealogy.isRenamed || comparison.hasTransition),
  };
}

function buildSignals(input: {
  locale: Locale;
  history: ActHistoryRow[];
  jumps: ActHistoryRow[];
  homeShare: number;
  clusterName: string;
  comparison: EarlyRecentComparison;
  genealogy: LifetimeGenealogy;
  disjointAgents: boolean;
  score: number;
  currentTier: number;
}): ReportSignal[] {
  const { locale, history, jumps, homeShare, clusterName, comparison, genealogy, disjointAgents, score } = input;
  const signals: ReportSignal[] = [];
  const ordered = [...history].sort((a, b) => actIdx(a.act) - actIdx(b.act));
  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  const actCount = ordered.filter((h) => h.games > 0).length;
  const pct = (v: number) => `${Math.round(v * 100)}%`;

  for (const j of jumps.slice(0, 3)) {
    signals.push({
      category: "rank", severity: "warn",
      title: L(locale, "急激なランク変動", "Sudden rank swing"),
      description: L(locale,
        `${j.act.toUpperCase()} に ${j.rankName} へ急変動（${j.games}試合）。短期間の大幅な上下はプレイヤー交代の兆候になりえます。`,
        `Jumped to ${j.rankName} in ${j.act.toUpperCase()} on ${j.games} games. Large short-term swings can indicate a different player.`),
    });
  }
  if (genealogy.hasClusterFlip) {
    signals.push({
      category: "cluster", severity: "alert",
      title: L(locale, "プレイサーバーの移動", "Play-server relocation"),
      description: L(locale,
        `初期は ${genealogy.earliestCluster} 中心だったのに対し、直近は ${genealogy.recentCluster} 中心です。物理的なプレイ環境の変更が疑われます。`,
        `Early matches center on ${genealogy.earliestCluster}, recent ones on ${genealogy.recentCluster}. Suggests the physical play location changed.`),
    });
  }
  if (genealogy.isRenamed) {
    signals.push({
      category: "activity", severity: "info",
      title: L(locale, "Riot ID の変更", "Riot ID changed"),
      description: L(locale,
        `記録上の旧名は ${genealogy.originalName}、現在は ${genealogy.currentName} です。改名自体は一般的ですが、譲渡時にも起こります。`,
        `Earliest recorded ID was ${genealogy.originalName}; now ${genealogy.currentName}. Renames are common but also happen on transfers.`),
    });
  }
  if (comparison.hasTransition) {
    const a = comparison.after, b = comparison.before;
    const parts = [
      Math.abs(comparison.kdDiff) >= 0.4 ? `K/D ${b.kd.toFixed(2)}→${a.kd.toFixed(2)}` : "",
      Math.abs(comparison.acsDiff) >= 60 ? `ACS ${Math.round(b.acs)}→${Math.round(a.acs)}` : "",
      Math.abs(comparison.hsDiff) >= 8 ? `HS ${b.hsRate.toFixed(1)}%→${a.hsRate.toFixed(1)}%` : "",
    ].filter(Boolean).join(" / ");
    signals.push({
      category: "time", severity: "warn",
      title: L(locale, "実力値の断絶", "Performance discontinuity"),
      description: L(locale,
        `前半と後半でスタッツが大きく変化（${parts}）。急な上手さ/下手さの切り替わりは別人プレイの可能性を示します。`,
        `Stats shifted sharply between the first and second half (${parts}). Abrupt skill changes can indicate a different player.`),
    });
  }
  if (disjointAgents) {
    signals.push({
      category: "time", severity: "warn",
      title: L(locale, "使用エージェントの断絶", "Agent pool discontinuity"),
      description: L(locale,
        `前半の主使用エージェントと後半の主使用エージェントが完全に入れ替わっています。`,
        `The top agents of the first and second half share nothing — a marked playstyle change.`),
    });
  }

  // Baseline normals — always worth stating, like the reference report does.
  if (first && last && score < 20) {
    signals.push({
      category: "normal", severity: "normal",
      title: L(locale, "長期的な自然成長トレンド（正常）", "Long-term natural growth (normal)"),
      description: L(locale,
        `初期（${first.act.toUpperCase()}: ${first.rankName}）から最新（${last.act.toUpperCase()}: ${last.rankName}）にかけて ${actCount} シーズンをかけた段階的な実力向上が確認されます。自力プレイによる自然な成長曲線です。`,
        `Gradual improvement across ${actCount} seasons, from ${first.act.toUpperCase()} ${first.rankName} to ${last.act.toUpperCase()} ${last.rankName}. A natural self-played growth curve.`),
    });
  }
  if (clusterName) {
    signals.push({
      category: "normal", severity: homeShare >= 0.8 ? "normal" : "info",
      title: L(locale, `${clusterName} サーバー中心のプレイ環境`, `Mostly ${clusterName} servers`),
      description: L(locale,
        `全保存試合の ${pct(homeShare)} が ${clusterName} サーバーで稼働しています。`,
        `${pct(homeShare)} of all stored matches ran on ${clusterName} servers.`),
    });
  }
  return signals;
}
