import type { Locale } from "./i18n/dict";
import { benchmarkFor, metricSigma } from "./rank-benchmarks.ts";
import { tierName } from "./henrik-shared.ts";
import type { LobbyResult } from "./lobby-analysis";
import type { EstimatedTrueRank, ReportSignal, SmurfVerdict, VerdictLabel } from "./report-model";
import { MIN_DIAGNOSIS_MATCHES } from "./report-scope.ts";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Same-sample comparison only; scores are indices, not calibrated probabilities. */
export function buildVerdict(input: {
  locale: Locale;
  level: number;
  lobby: LobbyResult;
}): SmurfVerdict {
  const { locale, level, lobby } = input;
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
  const { analysis, role } = lobby;
  const tier = analysis.referenceTier;
  const s = analysis.stats;
  const decided = lobby.bands.reduce((sum, b) => sum + b.wins + b.losses, 0);
  const enough = s.count >= MIN_DIAGNOSIS_MATCHES && decided >= 5 && tier >= 3 && role !== "unknown";
  const unavailable: VerdictLabel = {
    type: "INSUFFICIENT_DATA", color: "gray",
    label: role === "unknown" && s.count >= MIN_DIAGNOSIS_MATCHES
      ? L("ロールを確認できません", "Role not supported") : L("データ不足", "Insufficient data"),
    sublabel: role === "unknown" && s.count >= MIN_DIAGNOSIS_MATCHES
      ? L("主使用エージェントの基準が未登録です", "No benchmark is registered for the primary agent")
      : L("比較可能な直近試合が不足しています", "More comparable recent matches are needed"),
  };
  if (!enough) return {
    currentTier: tier,
    scores: { smurfScore: null, altScore: null, outlierScore: null },
    verdict: unavailable, estimatedTrueRank: null, benchmarksComparison: null,
    lobbyAnalysis: analysis,
    signals: [{
      category: "sample", severity: "info",
      title: L("診断を保留しています", "Diagnosis withheld"),
      description: role === "unknown" && s.count >= MIN_DIAGNOSIS_MATCHES ? L(
        "エージェントのロールを確認できないため、別ロールの基準で代用せず採点を保留します。",
        "The agent role is unknown. Scores are withheld rather than substituting another role's baseline.") : L(
        `直近90日・最大25試合から、完全なロスターと成績を持つCompetitiveが${MIN_DIAGNOSIS_MATCHES}試合以上（決着5試合以上）必要です。`,
        `Requires ${MIN_DIAGNOSIS_MATCHES}+ complete Competitive matches, including 5+ decided games, from at most 25 matches within 90 days.`),
    }],
  };

  const bench = benchmarkFor(tier, role);
  const hsZ = (s.hsRate - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4);
  const kdZ = (s.kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2);
  const acsZ = (s.acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25);
  const wrZ = (s.winRate - 50) / 25;
  const combatZ = (hsZ + kdZ + acsZ) / 3;
  const compositeZ = (hsZ + kdZ + acsZ + wrZ) / 4;
  const est = referenceRank(tier, lobby);
  const gap = est.tierGap;
  const smurfScore = gap >= 3 && combatZ >= 0.5
    ? clamp((gap - 2) * 12 + Math.max(0, compositeZ) * 25 + (s.winRate >= 60 ? 15 : 0)) : 0;
  // Low level alone, missing level and a short retrieved history imply nothing.
  const altScore = Number.isFinite(level) && level > 0 && level < 80 &&
    gap >= 3 && combatZ >= 0.75 ? clamp(smurfScore * 0.6 + 20) : 0;
  const outlierCount = [hsZ, kdZ, acsZ].filter((z) => z >= 2).length;
  const outlierScore = outlierCount >= 2
    ? clamp([hsZ, kdZ, acsZ].reduce((sum, z) => sum + Math.max(0, z - 1.5) * 20, 0)) : 0;
  const verdict: VerdictLabel = outlierScore >= 50 ? {
    type: "STATS_OUTLIER", color: "amber",
    label: L("成績がモデル範囲を超過", "Performance outside model"),
    sublabel: L("不正の有無を示す判定ではありません", "Does not establish cheating"),
  } : smurfScore >= 50 ? {
    type: "SMURF_SUSPECT", color: "amber",
    label: L("ランク差の兆候あり", "Rank mismatch indicators"),
    sublabel: L("比較モデル上でランク以上の成績", "Above-rank performance under the comparison model"),
  } : {
    type: "NATURAL_PLAYER", color: "emerald",
    label: L("強い不整合は未検出", "No strong mismatch detected"),
    sublabel: L("取得標本で判定基準に該当なし", "No scoring thresholds met in this sample"),
  };
  const signals: ReportSignal[] = [{
    category: "model", severity: "info",
    title: L("参考モデルとの比較", "Comparison with a reference model"),
    description: L(
      `${s.count}試合の本人ランク平均と同じ試合の成績を比較。実測母集団がないため、スマーフ・不正・本人性の証明には使えません。`,
      `Compares the owner's average recorded rank and stats from the same ${s.count} matches. Without population calibration, this cannot verify smurfing, cheating or identity.`),
  }];
  if (smurfScore >= 50 || outlierScore >= 50) signals.unshift({
    category: "performance", severity: "warn",
    title: verdict.label,
    description: L(
      `K/Dモデル偏差 ${kdZ.toFixed(2)}、ACS ${acsZ.toFixed(2)}、HS ${hsZ.toFixed(2)}。役割・対戦環境やモデルの仮定にも影響されます。`,
      `Model deviations: K/D ${kdZ.toFixed(2)}, ACS ${acsZ.toFixed(2)}, HS ${hsZ.toFixed(2)}. Role, opponents and model assumptions also affect the result.`),
  });
  return {
    currentTier: tier, scores: { smurfScore, altScore, outlierScore }, verdict,
    estimatedTrueRank: est, lobbyAnalysis: analysis, signals,
    benchmarksComparison: {
      currentRankName: tierName(tier), role,
      playerStats: { hs: s.hsRate, kd: s.kd, acs: s.acs, winRate: s.winRate },
      expectedStats: {
        hsMean: bench.meanHs, hsP95: bench.p95Hs, kdMean: bench.meanKd,
        kdP95: bench.p95Kd, acsMean: bench.meanAcs, acsP95: bench.p95Acs,
      },
      zScores: { hsZ, kdZ, acsZ, wrZ, combatZ, compositeZ },
    },
  };
}

function referenceRank(tier: number, lobby: LobbyResult): EstimatedTrueRank {
  const bound = (t: number) => Math.round(Math.max(3, Math.min(27, t)));
  const center = Math.max(3, Math.min(27, lobby.estimate.tier));
  const estimated = bound(center);
  const minTier = bound(center - lobby.estimate.sigma);
  const maxTier = bound(center + lobby.estimate.sigma);
  return {
    tier: estimated, tierName: tierName(estimated), tierGap: estimated - tier,
    modelRange: {
      minTier, maxTier, minTierName: tierName(minTier), maxTierName: tierName(maxTier),
      spanText: `${tierName(minTier)} - ${tierName(maxTier)}`,
    },
  };
}
