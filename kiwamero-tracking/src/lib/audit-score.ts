import type { Locale } from "./i18n/dict";
import type {
  AuditReport, ClusterEvidence, EarlyRecentComparison,
  LifetimeGenealogy, ReportSignal,
} from "./report-model";
import type { StoredRow } from "./stored-stats";
import { auditCountryByCode } from "./audit-countries.ts";
import { normalizeCluster } from "./henrik-shared.ts";
import { MIN_AUDIT_MATCHES } from "./report-evidence.ts";
import type { AuditChangePoint, AuditTimeline } from "./audit-timeline";
import type { AuditBreakdown } from "./report-model";
import { auditOriginShift, originSupportsBoundary } from "./audit-origin.ts";

const total = (points: AuditBreakdown) => Object.values(points).reduce((sum, n) => sum + n, 0);
const empty = (): AuditBreakdown => ({ rankScore: 0, serverScore: 0, performanceScore: 0, activityScore: 0 });

function signal(category: string, severity: ReportSignal["severity"], title: string, description: string): ReportSignal {
  return { category, severity, title, description };
}

function boundaryPoints(c: AuditChangePoint): AuditBreakdown {
  const performance = c.kind === "performance";
  const drop = c.comparison.before.meanTier - c.comparison.after.meanTier;
  const points = {
    performanceScore: performance ? (c.persistentLowKd ? 55 : 25) - (c.roleChanged ? 10 : 0) : 0,
    rankScore: c.persistentLowKd ? (drop >= 6 ? 20 : drop >= 3 ? 10 : 0) : 0,
    serverScore: c.server.changed ? (performance ? 20 : 10) : 0,
    activityScore: performance && c.hoursChanged ? 5 : 0,
  };
  if (c.gapDays >= 30) for (const key of Object.keys(points) as (keyof AuditBreakdown)[]) {
    points[key] = Math.round(points[key] / 2);
  }
  return points;
}

export function scoreAudit(input: {
  locale: Locale;
  cluster: ClusterEvidence;
  comparison: EarlyRecentComparison;
  genealogy: LifetimeGenealogy;
  rows: StoredRow[];
  auditCountry?: string;
  timeline: AuditTimeline;
}): AuditReport {
  const { locale, cluster, genealogy, rows, timeline } = input;
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
  const signals: ReportSignal[] = [];
  const matchedCountry = auditCountryByCode(input.auditCountry);
  const originShift = auditOriginShift(rows);
  // Select one assessment. Long-term and local server evidence share one cap.
  const events = timeline.candidates.map((boundary) => {
    const points = boundaryPoints(boundary);
    const origin = !!originShift && originSupportsBoundary(originShift, boundary, rows) &&
      originShift.points > points.serverScore;
    if (origin) points.serverScore = originShift!.points;
    return { boundary, points, origin };
  })
    .sort((a, b) => total(b.points) - total(a.points) || b.boundary.strength - a.boundary.strength);
  const originOnly = !!originShift && originShift.points > total(events[0]?.points ?? empty());
  const boundary = originOnly ? null : events[0]?.boundary ?? null;
  const comparison = boundary?.comparison ?? { ...input.comparison, hasTransition: false };
  const status = rows.length < MIN_AUDIT_MATCHES ? "insufficient"
    : timeline.comparableWindows === 0 ? "unassessable" : "assessed";
  const breakdown = status === "assessed"
    ? originOnly ? { ...empty(), serverScore: originShift!.points } : events[0]?.points ?? empty() : empty();
  const originScored = status === "assessed" && (originOnly || !!events[0]?.origin);
  const actualCluster = genealogy.recentCluster || cluster.home;
  const originMismatch = Boolean(matchedCountry && actualCluster &&
    normalizeCluster(actualCluster) !== normalizeCluster(matchedCountry.nativeServer));
  if (status !== "assessed") signals.push(signal("sample", "info", L("採点を保留", "Scoring withheld"),
    L("前後20試合のK/D・記録ランクを評価できません。未評価を変化なしとは扱いません。", "Cannot assess K/D and recorded ranks in 20-match windows. Unexamined history is not evidence of no change.")));
  if (boundary) {
    const date = new Date(boundary.at * 1000).toISOString().slice(0, 10);
    if (boundary.kind === "performance") signals.push(signal("performance", "warn",
      boundary.persistentLowKd ? L("継続的な低K/Dへの変化", "Persistent low-K/D change") : L("持続的なK/Dの不連続", "Sustained K/D discontinuity"),
      L(`${date}付近: K/D ${comparison.before.kd.toFixed(2)} → ${comparison.after.kd.toFixed(2)}。前後20試合、後半の各10試合でも継続しています。`,
        `Around ${date}: K/D ${comparison.before.kd.toFixed(2)} → ${comparison.after.kd.toFixed(2)} across 20 matches per side, persisting in both following 10-match halves.`)));
    if (breakdown.rankScore) signals.push(signal("rank", "warn", L("低い記録ランクでも低K/Dが継続", "Low K/D despite lower recorded ranks"),
      L("同じ境界の前後で本人の記録ランクも低下。ACTピークだけでは加点しません。対戦相手のランクは未確認です。",
        "Owner ranks also fell at this boundary. Act peaks alone add no points; opponent ranks are unverified.")));
    if (boundary.server.changed) signals.push(signal("server", "warn", L("同期間の主サーバー移行", "Local primary-server switch"),
      `${boundary.server.before} → ${boundary.server.after}. ${L("居住国の変更を証明しません。", "Does not establish a physical-country change.")}`));
    if (boundary.roleChanged) signals.push(signal("role", "info", L("ロール変更を考慮して減点", "Role change weakens the evidence"),
      L("役割の違いでもK/Dは変わるため、戦闘項目を10点減らします。", "Role differences can affect K/D; the combat contribution is reduced by 10.")));
    if (breakdown.activityScore) signals.push(signal("activity", "info", L("同期間の活動時間帯変化", "Concurrent play-hours shift"),
      L("同じ境界でUTC時間帯の分布も変化。所在地や本人性を示すものではありません。", "UTC play-hour distribution also changed at this boundary; this is not location or identity evidence.")));
    if (boundary.gapDays >= 30) signals.push(signal("gap", "info", L("長い記録間隔を考慮", "Long recording gap"),
      L(`比較期間に${Math.floor(boundary.gapDays)}日の空白。休止か履歴欠落かは不明なため、各加点を半減します。`,
        `${Math.floor(boundary.gapDays)} days without records within the comparison window. Inactivity vs missing history is unknown; each contribution is halved.`)));
  }
  if (originShift) signals.push(signal("server", originScored ? "warn" : "info",
    L("初期と直近で主な利用拠点が変化", "Stable initial-to-recent server change"),
    L(`${originShift.from} → ${originShift.to}。初期20試合中${originShift.earlyMatches}試合、直近40試合中${originShift.recentMatches}試合。`,
      `${originShift.from} → ${originShift.to}: ${originShift.earlyMatches}/20 initial and ${originShift.recentMatches}/40 recent matches.`) +
    " " + (originScored
      ? L(`サーバー項目は${breakdown.serverScore}点。局所移行とは重複加点しません。`, `Server contribution: ${breakdown.serverScore}. Not added twice for the local switch.`)
      : L("参考表示のみ。評価保留、または別の時期の採点対象には合算しません。", "Context only: withheld or not combined with an unrelated scored event.")) +
    (originShift.gapDays >= 30 ? L(" 30日以上の記録間隔があるため長期拠点の加点は半減します。", " A 30+ day recording gap halves the origin contribution.") : "") +
    L(" 居住国の変更や本人交代を証明するものではありません。", " This does not establish residence or identity changes.")));
  if (matchedCountry) signals.push(signal("country", "info", L("出品国籍は参考情報のみ", "Listed country is context only"),
    L("選択値とサーバーの一致・不一致は、実際の移動を観測していないため加点しません。", "Country/server agreement or mismatch adds no points: it is not an observed migration.")));
  if (genealogy.isRenamed) {
    signals.push(signal("name", "info", L("表示名の変化", "Display name changed"), L(`${genealogy.originalName} → ${genealogy.currentName}。名前変化自体は加点しません。`, `${genealogy.originalName} → ${genealogy.currentName}. The rename itself adds no score.`)));
  }

  const score = status === "assessed" ? Math.min(100, total(breakdown)) : null;
  const grade = score === null ? null : score >= 70 ? "S" : score >= 45 ? "A" : score >= 25 ? "B" : "C";
  const verdictLabel = grade === "S" ? L("複数の強い変化兆候", "Multiple strong change indicators")
    : grade === "A" ? L("複合的な変化兆候", "Compound change indicators")
    : grade === "B" ? L("限定的な変化兆候", "Limited change indicators")
    : grade === null ? L("履歴の評価を保留", "History assessment withheld")
    : L("採点範囲では強い不連続は未検出", "No strong discontinuity in assessed windows");
  const recommendation = grade === null
    ? L("試合数・記録ランク・K/Dの比較条件が不足しています。保留は正常判定ではありません。", "Match count, recorded-rank or K/D requirements are unmet. Withholding is not a normal verdict.")
    : grade === "S" || grade === "A"
    ? L("同じ境界の成績と利用傾向を確認してください。対戦相手・マップ・パーティ等の影響は未確認で、本人交代や譲渡を断定できません。", "Review performance and usage at the same boundary. Opponent, map and party effects remain unverified; this does not establish an identity or ownership change.")
    : grade === "B"
      ? L("限定的な変化兆候があります。単独の指標だけで判断しないでください。", "Limited indicators are present. Do not judge from a single signal.")
      : L("採点条件内では強い変化兆候を検出していません。", "No strong indicators were detected under the scoring rules.");

  return {
    score, grade, status, boundary, title: L("履歴変化指数", "History-change index"),
    ...(originShift ? { originShift, originScored } : {}),
    confidenceLabel: score === null ? L("評価保留", "Not assessed") : `${score} / 100 pt · Grade ${grade}`,
    verdictLabel, recommendation, signals,
    breakdown,
    comparison, evidence: { cluster, time: comparison }, lifetimeGenealogy: genealogy,
    matchedCountry, originMismatch,
  };
}
