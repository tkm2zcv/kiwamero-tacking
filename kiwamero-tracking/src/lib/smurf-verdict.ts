/**
 * スマーフ診断 — combines lobby performance, benchmark z-scores and the audit
 * evidence into smurf/alt/cheat scores plus a single player verdict.
 * Scores are heuristic references: they describe what the data resembles,
 * never a definitive judgement about a person.
 */
import type { Locale } from "./i18n/dict";
import { benchmarkFor, metricSigma, type AgentRole } from "./rank-benchmarks.ts";
import { tierName } from "./henrikdev.ts";
import type { LobbyResult } from "./lobby-analysis";
import type {
  AuditReport, BenchmarksComparison, EstimatedTrueRank, ReportSignal,
  SmurfVerdict, VerdictLabel, VerdictType,
} from "./report-model";
import type { Match as MatchT } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Math.round(v)));
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function buildVerdict(input: {
  locale: Locale;
  currentTier: number;
  currentRankName: string;
  level: number;
  role: AgentRole;
  lobby: LobbyResult;
  playerStats: { hs: number; kd: number; acs: number; winRate: number };
  audit: AuditReport;
  storedTotal: number;
  rosterMatches: MatchT[];
  spanMonths: number;
}): SmurfVerdict {
  const { locale, currentTier, currentRankName, level, role, lobby, playerStats, audit, storedTotal, rosterMatches, spanMonths } = input;
  const sampled = lobby.analysis.sampledMatches;

  // --- benchmark comparison at the player's current rank --------------------
  const bench = benchmarkFor(currentTier || 12, role);
  const hsZ = (playerStats.hs - bench.meanHs) / metricSigma(bench.meanHs, bench.p95Hs, 4);
  const kdZ = (playerStats.kd - bench.meanKd) / metricSigma(bench.meanKd, bench.p95Kd, 0.2);
  const acsZ = (playerStats.acs - bench.meanAcs) / metricSigma(bench.meanAcs, bench.p95Acs, 25);
  const combatZ = +((hsZ + kdZ + acsZ) / 3).toFixed(2);
  const compositeZ = +((combatZ + (sampled ? lobby.bands.reduce((s, b) => s + b.zScores.compositeZ * b.matchesCount, 0) / Math.max(1, sampled) : combatZ)) / 2).toFixed(2);

  const benchmarksComparison: BenchmarksComparison = {
    currentRankName, role,
    playerStats: {
      hs: +playerStats.hs.toFixed(1), kd: +playerStats.kd.toFixed(2),
      acs: Math.round(playerStats.acs), winRate: Math.round(playerStats.winRate),
    },
    expectedStats: {
      hsMean: bench.meanHs, hsP95: bench.p95Hs, kdMean: bench.meanKd,
      kdP95: bench.p95Kd, acsMean: bench.meanAcs, acsP95: bench.p95Acs,
    },
    zScores: {
      hsZ: +hsZ.toFixed(2), kdZ: +kdZ.toFixed(2), acsZ: +acsZ.toFixed(2),
      combatZ, compositeZ,
    },
  };

  // --- estimated true rank ---------------------------------------------------
  const est = estimateTrueRank(currentTier, lobby, sampled, combatZ);

  // --- scores ----------------------------------------------------------------
  const tierGap = est.tier - currentTier;
  const smurfScore = clamp(
    (tierGap >= 2 ? 25 + 12 * Math.min(tierGap, 5) : 0) +
    (compositeZ > 0.5 ? (compositeZ - 0.5) * 40 : 0) +
    (lobby.analysis.relativeStats.wrDelta > 10 ? 10 : 0));
  const altScore = clamp(
    (level > 0 && level < 80 ? 45 : level < 150 ? 30 : level < 250 ? 15 : level < 400 ? 8 : 0) +
    (storedTotal > 0 && storedTotal < 150 ? 15 : storedTotal < 400 ? 8 : 0) +
    (spanMonths > 0 && spanMonths < 3 ? 10 : 0));
  const cheatScore = clamp(
    Math.max(0, hsZ - 2) * 25 + Math.max(0, kdZ - 2) * 25 + Math.max(0, acsZ - 2) * 25 +
    (playerStats.hs > bench.p95Hs * 1.05 ? 15 : 0) +
    (playerStats.kd > bench.p95Kd * 1.05 ? 15 : 0) +
    (playerStats.acs > bench.p95Acs * 1.05 ? 15 : 0));

  const verdict = pickVerdict({
    locale, smurfScore, altScore, cheatScore,
    auditScore: audit.score, tierGap, sampled, storedTotal,
  });

  return {
    currentTier,
    scores: { smurfScore, altScore, cheatScore },
    verdict,
    estimatedTrueRank: est,
    lobbyAnalysis: lobby.analysis,
    benchmarksComparison,
    signals: verdictSignals({
      locale, verdict, level, currentRankName, est, tierGap,
      benchmarksComparison, sampled, auditScore: audit.score,
      rosterCount: rosterMatches.length,
    }),
  };
}

function estimateTrueRank(
  currentTier: number, lobby: LobbyResult, sampled: number, combatZ: number,
): EstimatedTrueRank {
  let estTier = lobby.estimate.tier;
  let sigma = lobby.estimate.sigma;
  if (estTier <= 0 || !sampled) {
    // No usable lobby sample — fall back to current-rank z, heavily uncertain.
    estTier = (currentTier || 12) + combatZ / 0.3;
    sigma = 2.5;
  }
  estTier = Math.min(27, Math.max(3, estTier));
  const probs: Record<number, number> = {};
  let sum = 0;
  for (let t = 3; t <= 27; t++) {
    const p = Math.exp(-((t - estTier) ** 2) / (2 * sigma * sigma));
    probs[t] = p; sum += p;
  }
  for (const t of Object.keys(probs)) probs[+t] = +(probs[+t] / sum).toFixed(4);

  // smallest contiguous 90% interval
  let lo = Math.round(estTier), hi = lo, mass = probs[lo] ?? 0;
  while (mass < 0.9 && (lo > 3 || hi < 27)) {
    const down = lo > 3 ? probs[lo - 1] : 0;
    const up = hi < 27 ? probs[hi + 1] : 0;
    if (up >= down) { hi++; mass += up; } else { lo--; mass += down; }
  }
  const estRound = Math.round(estTier);
  const tierGap = currentTier ? estRound - currentTier : 0;
  const name = (t: number) => tierName(Math.min(27, Math.max(3, Math.round(t)))) || "—";
  const confidence = sampled >= 15 && sigma <= 0.8 ? "high"
    : sampled >= 6 || sigma <= 1.2 ? "medium" : "low";
  return {
    tierName: name(estTier), tier: estRound, tierGap, confidence,
    confidenceInterval90: {
      minTier: lo, maxTier: hi, minTierName: name(lo), maxTierName: name(hi),
      spanText: `${name(lo)} 〜 ${name(hi)}`,
    },
    probabilities: probs,
  };
}

function pickVerdict(input: {
  locale: Locale; smurfScore: number; altScore: number; cheatScore: number;
  auditScore: number; tierGap: number; sampled: number; storedTotal: number;
}): VerdictLabel {
  const { locale, smurfScore, altScore, cheatScore, auditScore, sampled, storedTotal } = input;
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);
  const make = (type: VerdictType, label: string, sublabel: string, color: VerdictLabel["color"]): VerdictLabel =>
    ({ type, label, sublabel, color });

  if (sampled < 3 && storedTotal < 30) {
    return make("INSUFFICIENT_DATA", L("データ不足", "Insufficient data"),
      L("判定に必要な試合データが足りていません", "Not enough match data for a verdict"), "gray");
  }
  if (cheatScore >= 50) {
    return make("CHEAT_SUSPECT", L("不正ツール疑い", "Possible cheating"),
      L("所属ランクの統計範囲を大きく超える異常値", "Stats far beyond the range expected at this rank"), "red");
  }
  if (smurfScore >= 50) {
    return make("SMURF_SUSPECT", L("スマーフ疑惑", "Likely smurf"),
      L("推定実力が所属ランクを大幅に上回っています", "Estimated skill is well above the current rank"), "amber");
  }
  if (altScore >= 50) {
    return make("ALT_ACCOUNT", L("サブ垢の可能性", "Possible alt account"),
      L("アカウント年齢・レベルに対して実績が先行しています", "Results outpace the account's age/level"), "sky");
  }
  if (auditScore >= 45) {
    return make("SHARED_OR_BOOSTED", L("共有・代行の疑い", "Shared or boosted?"),
      L("プレイ環境・実力推移に交代兆候が見られます", "Environment/performance history shows handover markers"), "violet");
  }
  return make("NATURAL_PLAYER", L("適正プレイヤー", "Fair player"),
    L("所属ランク相応の健全な推移（自力成長）", "Healthy progression consistent with the current rank"), "emerald");
}

function verdictSignals(input: {
  locale: Locale; verdict: VerdictLabel; level: number; currentRankName: string;
  est: EstimatedTrueRank; tierGap: number;
  benchmarksComparison: BenchmarksComparison; sampled: number; auditScore: number;
  rosterCount: number;
}): ReportSignal[] {
  const { locale, verdict, level, currentRankName, est, tierGap, benchmarksComparison: bc, sampled, auditScore, rosterCount } = input;
  const L = (ja: string, en: string) => (locale === "ja" ? ja : en);
  const signals: ReportSignal[] = [];

  if (verdict.type === "INSUFFICIENT_DATA") {
    signals.push({
      category: "normal", severity: "info",
      title: L("標本不足", "Sample too small"),
      description: L("ロビー内診断にはコンペティティブ試合のロスター情報が必要です。再読み込みで詳細取得が進みます。",
        "Lobby analysis needs full rosters from competitive matches; revisiting loads more detail."),
    });
    return signals;
  }
  if (verdict.type === "NATURAL_PLAYER") {
    signals.push({
      category: "normal", severity: "normal",
      title: L("健全なプレイ推移", "Healthy progression"),
      description: L(
        `現在のアカウントレベル（Lv.${level}）および所属ランク（${currentRankName}）に対して、統計的に正常な範囲内のスタッツです。`,
        `Stats sit inside the expected range for account level Lv.${level} and current rank ${currentRankName}.`),
    });
  }
  if (tierGap >= 2) {
    signals.push({
      category: "lobby", severity: "warn",
      title: L("推定実力が所属ランクを上回る", "Estimated skill above current rank"),
      description: L(
        `ロビー内パフォーマンスからの最尤推定は ${est.tierName}（${est.confidenceInterval90.spanText}・信頼度:${est.confidence}）。所属 ${currentRankName} より ${tierGap} ティア上です。`,
        `Lobby-based MLE reads ${est.tierName} (90% CI ${est.confidenceInterval90.spanText}, ${est.confidence} confidence) — ${tierGap} tiers above ${currentRankName}.`),
    });
  }
  const z = bc.zScores;
  const outliers = [
    z.hsZ > 2 ? `HS% z=${z.hsZ}` : "", z.kdZ > 2 ? `K/D z=${z.kdZ}` : "", z.acsZ > 2 ? `ACS z=${z.acsZ}` : "",
  ].filter(Boolean);
  if (outliers.length) {
    signals.push({
      category: "cheat", severity: "alert",
      title: L("統計的異常値", "Statistical outliers"),
      description: L(
        `${outliers.join(", ")} が ${bc.currentRankName}・${capitalize(bc.role)} 基準の p95 を超過。チートまたは別次元のプレイ傾向を示唆します。`,
        `${outliers.join(", ")} exceed the ${bc.currentRankName} ${capitalize(bc.role)} p95 markers — consistent with cheating or highly unusual play.`),
    });
  }
  if (verdict.type === "ALT_ACCOUNT") {
    signals.push({
      category: "alt", severity: "info",
      title: L("浅いアカウント年齢", "Young account"),
      description: L(
        `アカウントレベル Lv.${level} と記録試合数に対して上位のパフォーマンス。サブ垢・移行垢の可能性があります。`,
        `Strong performance relative to level Lv.${level} and recorded matches — consistent with an alt/transferred account.`),
    });
  }
  if (auditScore >= 45) {
    signals.push({
      category: "audit", severity: "warn",
      title: L("査定側に交代シグナル", "Audit shows handover markers"),
      description: L(
        "アカウント査定でサーバー移動・実力断絶・ランク跳躍などのシグナルが検出されています。詳細はアカウント査定タブを参照。",
        "The account audit flagged server moves, performance breaks or rank jumps — see the Account Audit tab."),
    });
  }
  signals.push({
    category: "scope", severity: "info",
    title: L("分析対象", "Analysis scope"),
    description: L(
      `ロビー標本 ${sampled} 試合（ロスター取得 ${rosterCount} 試合）＋保存履歴ベンチマーク比較。推定は参考値です。`,
      `Lobby sample: ${sampled} competitive matches (${rosterCount} rosters fetched) plus stored-history benchmarks. Estimates are reference values.`),
  });
  return signals;
}
