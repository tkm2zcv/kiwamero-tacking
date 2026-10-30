/**
 * Data model for the Account Audit (アカウント査定) and Smurf Diagnosis
 * (スマーフ診断) reports. Shapes mirror the observable output of the previous
 * tracker so both tabs can share one computed AccountReport.
 */

import type { AuditTimeline } from "./audit-timeline";
import type { AuditCoverage } from "./audit-coverage";

export type Severity = "normal" | "info" | "warn" | "alert";

export interface ReportSignal {
  category: string;
  severity: Severity;
  title: string;
  description: string;
}

/** Aggregate stats for a slice of stored matches (a period or a cluster). */
export interface StatBlock {
  count: number;
  kd: number;
  acs: number;
  hsRate: number;
  accuracyCount: number;
  winRate: number;
  topAgents: [string, number][];
  meanTier: number;
}

export interface EarlyRecentComparison {
  kind: "early_recent";
  comparable: boolean;
  /** True when at least one metric moved past its discontinuity threshold. */
  hasTransition: boolean;
  before: StatBlock;
  after: StatBlock;
  hsDiff: number;
  acsDiff: number;
  kdDiff: number;
}

export interface LifetimeGenealogy {
  oldestMatchDate: string;
  newestMatchDate: string;
  lifetimeSpanMonths: number;
  totalLifetimeMatches: number;
  earliestCluster: string;
  recentCluster: string;
  hasClusterFlip: boolean;
  lifetimeClusterBreakdown: Record<string, number>;
  originalName: string;
  currentName: string;
  isRenamed: boolean;
  earliestLevel?: number;
}

export interface ActHistoryRow {
  act: string;
  tier: number;
  rankName: string;
  games: number;
  wins: number;
  winRate: number;
  primaryServer?: string;
}

export interface AuditBreakdown {
  rankScore: number;
  serverScore: number;
  performanceScore: number;
  activityScore: number;
}

export interface ClusterEvidence {
  home: string;
  homeMatchCount: number;
  hasClusterFlip: boolean;
  breakdown: Record<string, number>;
  clusters: Record<string, StatBlock>;
  knownMatches: number;
}

/** Descriptive history-change report; never an ownership probability. */
export interface AuditReport {
  /** Heuristic change index, NOT an ownership probability. */
  score: number | null;
  grade: "S" | "A" | "B" | "C" | null;
  title: string;
  confidenceLabel: string;
  recommendation: string;
  signals: ReportSignal[];
  breakdown: AuditBreakdown;
  comparison: EarlyRecentComparison;
  evidence: { cluster: ClusterEvidence; time: EarlyRecentComparison };
  lifetimeGenealogy: LifetimeGenealogy;
}

export type VerdictType =
  | "NATURAL_PLAYER"
  | "SMURF_SUSPECT"
  | "ALT_ACCOUNT"
  | "STATS_OUTLIER"
  | "INSUFFICIENT_DATA";

export type VerdictColor = "emerald" | "amber" | "sky" | "red" | "violet" | "gray";

export interface VerdictLabel {
  type: VerdictType;
  label: string;
  sublabel: string;
  color: VerdictColor;
}

export interface EstimatedTrueRank {
  tierName: string;
  tier: number;
  tierGap: number;
  modelRange: {
    minTier: number;
    maxTier: number;
    minTierName: string;
    maxTierName: string;
    spanText: string;
  };
}

export interface BandPerformance {
  bandName: string;
  minTier: number;
  maxTier: number;
  matchesCount: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kd: number;
  acs: number;
  hsRate: number;
  benchmark: { meanKd: number; p95Kd: number; meanAcs: number; p95Acs: number; meanHs: number; p95Hs: number };
  zScores: { kdZ: number; acsZ: number; hsZ: number; wrZ: number; compositeZ: number };
  evaluation: "far_above" | "above_average" | "average" | "below_average" | "far_below";
}

export interface OpponentTiers {
  totalOpponents: number;
  tierCounts: Record<number, number>;
  minTier: number;
  maxTier: number;
  avgTier: number;
  medianTier: number;
  minTierName: string;
  maxTierName: string;
  avgTierName: string;
  tierDistribution: { tier: number; tierName: string; count: number; percentage: number }[];
}

export interface LobbyAnalysis {
  sampledMatches: number;
  avgLobbyTier: number;
  avgLobbyTierName: string;
  tierSpan: string;
  combatParity: BandPerformance["evaluation"];
  performanceDescription: string;
  relativeStats: { kdDelta: number; acsDelta: number; hsDelta: number; wrDelta: number };
  eloBandPerformance: BandPerformance[];
  encounteredOpponents: OpponentTiers;
  stats: StatBlock;
  referenceTier: number;
}

export interface BenchmarksComparison {
  currentRankName: string;
  role: string;
  playerStats: { hs: number; kd: number; acs: number; winRate: number };
  expectedStats: { hsMean: number; hsP95: number; kdMean: number; kdP95: number; acsMean: number; acsP95: number };
  zScores: { hsZ: number; kdZ: number; acsZ: number; wrZ: number; combatZ: number; compositeZ: number };
}

/** スマーフ診断 — whether the player performs at/below/above their rank. */
export interface SmurfVerdict {
  currentTier: number;
  scores: { smurfScore: number | null; altScore: number | null; outlierScore: number | null };
  verdict: VerdictLabel;
  estimatedTrueRank: EstimatedTrueRank | null;
  lobbyAnalysis: LobbyAnalysis;
  benchmarksComparison: BenchmarksComparison | null;
  signals: ReportSignal[];
}

export interface AccountReport {
  locale: "en" | "ja";
  generatedAt: string;
  sample: {
    storedMatches: number; rosterMatches: number; competitiveRows: number;
    /** Unique Competitive record IDs excluded for invalid/future/missing statistics. */
    excludedStoredMatches: number;
    diagnosisFrom: string; diagnosisTo: string;
  };
  history: ActHistoryRow[];
  serverStats: {
    total: number;
    knownMatches: number;
    topCluster: string;
    clusters: Record<string, number>;
    percentages: Record<string, number>;
  };
  clusterStats: Record<string, StatBlock>;
  lifetimeGenealogy: LifetimeGenealogy;
  comparison: EarlyRecentComparison;
  audit: AuditReport;
  verdict: SmurfVerdict;
  auditTimeline: AuditTimeline;
  auditCoverage?: AuditCoverage;
}
