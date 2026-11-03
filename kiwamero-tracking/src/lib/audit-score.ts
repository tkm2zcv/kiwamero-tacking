import type { Locale } from "./i18n/dict";
import type {
  ActHistoryRow, AuditReport, ClusterEvidence, EarlyRecentComparison,
  LifetimeGenealogy, ReportSignal, StatBlock,
} from "./report-model";
import type { StoredRow } from "./stored-stats";
import { agentRole } from "./rank-benchmarks.ts";
import { auditCountryByCode } from "./audit-countries.ts";
import { normalizeCluster } from "./henrik-shared.ts";
import { MIN_AUDIT_MATCHES } from "./report-evidence.ts";

type Band = { hs: number; hsSd: number; kd: number; kdSd: number; acs: number; acsSd: number };
const BENCH: Record<string, Band> = {
  Iron: { hs: 12.15, hsSd: 7.01, kd: 1.04, kdSd: .72, acs: 197.33, acsSd: 78.39 },
  Bronze: { hs: 16.11, hsSd: 8.97, kd: 1.12, kdSd: 1.31, acs: 208.1, acsSd: 83.14 },
  Silver: { hs: 20.27, hsSd: 10.67, kd: 1.14, kdSd: .83, acs: 212.59, acsSd: 93.21 },
  Gold: { hs: 21.09, hsSd: 9.61, kd: 1.09, kdSd: .64, acs: 210.91, acsSd: 79.95 },
  Platinum: { hs: 24.15, hsSd: 10.98, kd: 1.06, kdSd: .58, acs: 207.74, acsSd: 80.07 },
  Diamond: { hs: 27.39, hsSd: 11.48, kd: 1.19, kdSd: .67, acs: 212.03, acsSd: 85.07 },
  Ascendant: { hs: 29.03, hsSd: 10.53, kd: 1.13, kdSd: .56, acs: 215.23, acsSd: 75.93 },
  Immortal: { hs: 30.11, hsSd: 9.99, kd: 1.1, kdSd: .57, acs: 212.5, acsSd: 74.8 },
  Radiant: { hs: 32.41, hsSd: 11.24, kd: 1.27, kdSd: .6, acs: 233.19, acsSd: 77.22 },
};
const TRANSITION = { deltaMean: .474, deltaSd: 2.0197, deltaP98: 5, velocityP95: .125 };
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

function band(tier: number): string {
  if (tier <= 5) return "Iron";
  if (tier <= 8) return "Bronze";
  if (tier <= 11) return "Silver";
  if (tier <= 14) return "Gold";
  if (tier <= 17) return "Platinum";
  if (tier <= 20) return "Diamond";
  if (tier <= 23) return "Ascendant";
  if (tier <= 26) return "Immortal";
  return "Radiant";
}

function eraAdjustedTier(act: string, tier: number): number {
  const m = act.match(/^e(\d+)a(\d+)$/i);
  if (!m) return tier;
  const ep = Number(m[1]), a = Number(m[2]);
  if (ep === 1) return tier <= 20 ? 21 : tier <= 23 ? 22 : tier <= 25 ? 24 : tier <= 29 ? 25 : 26;
  if (ep === 2 && a === 1) return Math.min(27, tier + 3);
  if (ep === 4 && a === 3) return Math.min(27, tier + 3);
  if (ep === 7 && a === 3) return Math.min(27, tier + 3);
  return tier;
}

function actGap(a: string, b: string): number {
  const p = (code: string) => {
    const m = code.match(/^e(\d+)a(\d+)$/i);
    return m ? Number(m[1]) * 3 + Number(m[2]) : 0;
  };
  return Math.abs(p(a) - p(b));
}

function duelistShare(block: StatBlock): number {
  const total = block.count || block.topAgents.reduce((sum, [, count]) => sum + count, 0);
  const duel = block.topAgents.filter(([agent]) => agentRole(agent) === "duelist")
    .reduce((sum, [, count]) => sum + count, 0);
  return total ? duel / total : 0;
}

function signal(category: string, severity: ReportSignal["severity"], title: string, description: string): ReportSignal {
  return { category, severity, title, description };
}

export function scoreAudit(input: {
  locale: Locale;
  history: ActHistoryRow[];
  cluster: ClusterEvidence;
  comparison: EarlyRecentComparison;
  genealogy: LifetimeGenealogy;
  rows: StoredRow[];
  currentTier: number;
  transition?: { from: string; to: string };
  auditCountry?: string;
}): AuditReport {
  const { locale, history, cluster, comparison, genealogy, rows, transition } = input;
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
  const records = history
    .filter((r) => r.tier > 0 && r.games >= 3)
    .map((r) => ({ ...r, adjustedTier: eraAdjustedTier(r.act, r.tier) }))
    .sort((a, b) => actGap("e0a0", a.act) - actGap("e0a0", b.act));
  const signals: ReportSignal[] = [];
  let rankScore = 0, serverScore = 0, performanceScore = 0, activityScore = 0;
  const matchedCountry = auditCountryByCode(input.auditCountry);

  if (rows.length < MIN_AUDIT_MATCHES) {
    const score: AuditReport = {
      score: null, grade: null,
      title: L("履歴変化の採点保留", "History audit withheld"),
      confidenceLabel: L("採点不可", "Not scored"),
      verdictLabel: L("保存履歴が不足しています", "Stored history is insufficient"),
      recommendation: L(`Competitive履歴が${MIN_AUDIT_MATCHES}試合以上必要です。`, `Requires ${MIN_AUDIT_MATCHES}+ competitive matches.`),
      signals: [signal("sample", "info", L("採点を保留", "Scoring withheld"), L("不足データは変化なしの証拠として扱いません。", "Missing history is not evidence of no change."))],
      breakdown: { rankScore: 0, serverScore: 0, performanceScore: 0, activityScore: 0 },
      comparison, evidence: { cluster, time: comparison }, lifetimeGenealogy: genealogy,
      matchedCountry, originMismatch: false,
    };
    return score;
  }

  // ③ Rank trajectory: episode-era adjusted act-to-act changes.
  const peak = Math.max(...records.map((r) => r.adjustedTier), 0);
  const recent = records.slice(-2);
  const recentMin = Math.min(...recent.map((r) => r.adjustedTier), 99);
  const recentMax = Math.max(...recent.map((r) => r.adjustedTier), 0);
  if (peak >= 23 && recentMin <= 16 && recentMax < 20) {
    rankScore += 35;
    signals.push(signal("rank", "alert", L("高ランクからの急落", "Extreme derank"), L("過去の高ランク帯から直近の低ランク帯へ、通常のリセット幅を超える移動があります。", "History moves from a high rank band to a much lower recent band beyond a normal reset.")));
  } else if (peak >= 23 && recentMin <= 20 && recentMax <= 22) {
    rankScore += 20;
    signals.push(signal("rank", "warn", L("大きなデランク", "Large derank"), L("高ランク帯から直近で大きく下落しています。", "A large drop from the historical peak band is present.")));
  }
  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1], curr = records[i];
    const gap = Math.max(1, actGap(prev.act, curr.act));
    const delta = curr.adjustedTier - prev.adjustedTier;
    const velocity = delta / gap;
    if (delta > 0 && ((delta >= 4 && gap <= 2 && velocity >= TRANSITION.velocityP95) || (delta >= TRANSITION.deltaP98 && gap <= 4))) {
      const points = Math.min(18, 6 + delta * 2);
      rankScore += points;
      signals.push(signal("rank", "warn", L("急速なランク上昇", "Rapid rank jump"), L(`${prev.rankName} → ${curr.rankName}（${delta}ティア / ${gap}ACT）`, `${prev.rankName} → ${curr.rankName} (${delta} tiers / ${gap} acts)`)));
    } else if (delta < 0 && Math.abs(delta) >= 6 && gap <= 2) {
      const points = Math.min(12, 4 + Math.abs(delta));
      rankScore += points;
      signals.push(signal("rank", "warn", L("短期間の大幅ダウン", "Abrupt derank"), L(`${prev.rankName} → ${curr.rankName}（${Math.abs(delta)}ティア / ${gap}ACT）`, `${prev.rankName} → ${curr.rankName} (${Math.abs(delta)} tiers / ${gap} acts)`)));
    }
  }
  rankScore = Math.min(35, rankScore);
  if (!rankScore && records.length >= 2 && records.at(-1)!.adjustedTier > records[0].adjustedTier + 3) {
    signals.push(signal("rank", "normal", L("自然なランク推移", "Gradual rank progression"), L("急激なACT間移動は検出されていません。", "No abrupt act-to-act movement was detected.")));
  }

  // ① Server / base migration. A server change alone stays below A.
  const from = transition?.from ?? genealogy.earliestCluster;
  const to = transition?.to ?? genealogy.recentCluster;
  const actualCluster = to || cluster.home;
  if (genealogy.hasClusterFlip && from && to && from !== to) {
    const points = from !== "Tokyo" && to === "Tokyo" ? 25 : from === "Tokyo" ? 20 : 15;
    serverScore += points;
    signals.push(signal("server", "warn", L("主利用サーバーの移行", "Primary server shift"), L(`${from}中心から${to}中心へ変化しています。`, `Dominant cluster changed from ${from} to ${to}.`)));
  } else if (cluster.home) {
    signals.push(signal("server", "normal", L("主利用サーバーは安定", "Stable primary server"), L(`${cluster.home}が主要サーバーです。`, `${cluster.home} is the dominant cluster.`)));
  }
  const originMismatch = Boolean(matchedCountry && actualCluster &&
    normalizeCluster(actualCluster) !== normalizeCluster(matchedCountry.nativeServer));
  if (matchedCountry) {
    const countryName = locale === "ja" ? matchedCountry.nameJa : matchedCountry.nameEn;
    if (originMismatch) {
      serverScore += 15;
      signals.push(signal("country", "alert", L("選択国籍と主要サーバーが不一致", "Selected country/server mismatch"), L(`${countryName}の想定サーバーは${matchedCountry.nativeServer}、観測主サーバーは${actualCluster}です。`, `Expected ${matchedCountry.nativeServer} for ${countryName}; observed ${actualCluster}.`)));
    } else {
      signals.push(signal("country", "normal", L("選択国籍とサーバーが一致", "Selected country/server match"), L(`${countryName}の想定サーバー${matchedCountry.nativeServer}と一致しています。`, `Matches the expected ${matchedCountry.nativeServer} server for ${countryName}.`)));
    }
  }
  serverScore = Math.min(40, serverScore);

  // ② Physical/combat transformation. Kept behind the existing comparability gate.
  if (comparison.comparable) {
    const bench = BENCH[band(input.currentTier || comparison.after.meanTier || records.at(-1)?.adjustedTier || 15)];
    const changes = [
      { key: "K/D", diff: comparison.kdDiff, abs: .4, z: comparison.kdDiff / bench.kdSd },
      { key: "ACS", diff: comparison.acsDiff, abs: 60, z: comparison.acsDiff / bench.acsSd },
      { key: "HS", diff: comparison.hsDiff, abs: 8, z: comparison.hsDiff / bench.hsSd },
    ];
    const moved = changes.filter((m) => Math.abs(m.diff) >= m.abs);
    if (moved.length >= 2) {
      performanceScore += moved.length >= 3 ? 35 : 25;
      signals.push(signal("performance", "warn", L("戦闘指標の不連続な変化", "Discontinuous combat change"), L(`${moved.map((m) => m.key).join(" / ")} が期間閾値を超過しました。`, `${moved.map((m) => m.key).join(" / ")} exceeded period thresholds.`)));
    }
    const zMoves = changes.filter((m) => Math.abs(m.z) >= 2);
    if (zMoves.length) {
      performanceScore += Math.min(15, zMoves.length * 8);
      signals.push(signal("performance", zMoves.length >= 2 ? "warn" : "info", L("ランク帯基準からの成績変化", "Stats changed versus rank-band model"), L(`${zMoves.map((m) => `${m.key} Z${m.z.toFixed(1)}`).join(" / ")}。モデルの仮定値との比較です。`, `${zMoves.map((m) => `${m.key} Z${m.z.toFixed(1)}`).join(" / ")} compared with assumed rank-band values.`)));
    }
    const beforeRole = comparison.before.topAgents[0] ? agentRole(comparison.before.topAgents[0][0]) : "unknown";
    const afterRole = comparison.after.topAgents[0] ? agentRole(comparison.after.topAgents[0][0]) : "unknown";
    const beforeDuel = duelistShare(comparison.before), afterDuel = duelistShare(comparison.after);
    if ((beforeRole !== "duelist" && afterRole === "duelist") || (afterDuel >= .5 && beforeDuel <= .3)) {
      activityScore += 15;
      signals.push(signal("activity", "warn", L("エージェント役割の変化", "Agent role shift"), L(`${comparison.before.topAgents[0]?.[0] ?? "-"} → ${comparison.after.topAgents[0]?.[0] ?? "-"}、直近はデュエリスト中心です。`, `${comparison.before.topAgents[0]?.[0] ?? "-"} → ${comparison.after.topAgents[0]?.[0] ?? "-"}; recent play is duelist-heavy.`)));
    }
  } else {
    signals.push(signal("performance", "info", L("成績変化の採点は保留", "Performance scoring withheld"), L("比較期間の標本・ランク帯・射撃データの条件を満たしていません。", "Period samples, rank environment or shot data do not meet the comparison requirements.")));
  }
  if (genealogy.isRenamed) {
    signals.push(signal("name", "info", L("表示名の変化", "Display name changed"), L(`${genealogy.originalName} → ${genealogy.currentName}。名前変化自体は加点しません。`, `${genealogy.originalName} → ${genealogy.currentName}. The rename itself adds no score.`)));
  }

  const score = clamp(rankScore + serverScore + Math.min(35, performanceScore) + activityScore);
  const grade = score >= 70 ? "S" : score >= 45 ? "A" : score >= 25 ? "B" : "C";
  const verdictLabel = grade === "S" ? L("複数の強い変化兆候", "Multiple strong change indicators")
    : grade === "A" ? L("複合的な変化兆候", "Compound change indicators")
    : grade === "B" ? L("限定的な変化兆候", "Limited change indicators")
    : L("顕著な変化は未検出", "No strong change detected");
  const recommendation = grade === "S" || grade === "A"
    ? L("履歴・サーバー・戦績の複数項目が重なっています。個別証拠を確認し、参考指数だけで本人性や譲渡を断定しないでください。", "Multiple evidence classes overlap. Review each signal; do not infer identity or ownership from the index alone.")
    : grade === "B"
      ? L("限定的な変化兆候があります。単独の指標だけで判断しないでください。", "Limited indicators are present. Do not judge from a single signal.")
      : L("採点条件内では強い変化兆候を検出していません。", "No strong indicators were detected under the scoring rules.");

  return {
    score, grade, title: L("履歴変化指数", "History-change index"),
    confidenceLabel: L(`${score} / 100 pt・Grade ${grade}`, `${score} / 100 pt · Grade ${grade}`),
    verdictLabel, recommendation, signals,
    breakdown: { rankScore, serverScore, performanceScore: Math.min(35, performanceScore), activityScore },
    comparison, evidence: { cluster, time: comparison }, lifetimeGenealogy: genealogy,
    matchedCountry, originMismatch,
  };
}
