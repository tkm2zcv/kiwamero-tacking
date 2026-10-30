/**
 * Builds the shared AccountReport powering the Account Audit (アカウント査定)
 * and Smurf Diagnosis (スマーフ診断) tabs. Lifetime evidence comes from the
 * stored match history; lobby-level reads come from sampled full rosters.
 */
import type { Locale } from "./i18n/dict";
import type { Match, Profile, SeasonRank } from "./types";
import type { StoredRow } from "./stored-stats";
import {
  buildClusterEvidence, buildGenealogy, buildHistory, earlyRecentComparison, statBlock,
} from "./report-evidence.ts";
import { scoreAudit } from "./audit-score.ts";
import { analyzeLobby } from "./lobby-analysis.ts";
import { buildVerdict } from "./smurf-verdict.ts";
import type { AccountReport } from "./report-model";
import { recentReportRosters } from "./report-scope.ts";
import { auditTimeline, validAuditRows } from "./audit-timeline.ts";
import type { AuditCoverage } from "./audit-coverage";

export type { AccountReport } from "./report-model";

export function buildAccountReport(input: {
  profile: Pick<Profile, "name" | "tag" | "puuid" | "level" | "region" | "currentTier" | "currentRank">;
  seasons: SeasonRank[];
  storedAll: StoredRow[];
  /** Full-roster competitive matches (v3 recent + fetched details). */
  rosterMatches: Match[];
  locale: Locale;
  generatedAt: string;
  auditRosters?: Match[];
  auditCoverage?: AuditCoverage;
}): AccountReport {
  const { profile, seasons, locale, generatedAt } = input;
  const storedAll = validAuditRows(input.storedAll, Date.parse(generatedAt) / 1000);
  const rosterMatches = recentReportRosters(input.rosterMatches, generatedAt);
  const self = { name: profile.name, tag: profile.tag };

  const timeline = auditTimeline(storedAll, input.auditRosters, profile.puuid);
  const strongest = timeline.candidates[0];
  const comparison = strongest?.comparison ?? earlyRecentComparison(storedAll);
  const genealogy = buildGenealogy(storedAll, self);
  const cluster = buildClusterEvidence(storedAll);
  cluster.hasClusterFlip = genealogy.hasClusterFlip;
  const history = buildHistory(seasons, storedAll);

  const audit = scoreAudit({
    locale, history, cluster, comparison, genealogy, transition: strongest?.server,
  });

  const topAgents = statBlock(storedAll).topAgents;
  const lobby = analyzeLobby(
    rosterMatches, profile.puuid, topAgents, locale,
  );
  const verdict = buildVerdict({
    locale, level: profile.level, lobby,
  });

  const clusters = genealogy.lifetimeClusterBreakdown;
  const total = cluster.knownMatches || 1;
  const dates = rosterMatches.filter((m) => lobby.sampledMatchIds.includes(m.metadata.matchid))
    .map((m) => m.metadata.game_start);
  const date = (ts: number) => Number.isFinite(ts) ? new Date(ts * 1000).toISOString().slice(0, 10) : "";
  return {
    locale,
    generatedAt,
    sample: {
      storedMatches: storedAll.length,
      excludedStoredMatches: Math.max(0, new Set(input.storedAll.filter((r) =>
        typeof r.mode === "string" && r.mode.toLowerCase() === "competitive").map((r) => r.id)).size - storedAll.length),
      rosterMatches: rosterMatches.length,
      competitiveRows: storedAll.filter((r) => /competitive/i.test(r.mode)).length,
      diagnosisFrom: date(Math.min(...dates)),
      diagnosisTo: date(Math.max(...dates)),
    },
    history,
    serverStats: {
      total: storedAll.length,
      knownMatches: cluster.knownMatches,
      topCluster: cluster.home,
      clusters,
      percentages: Object.fromEntries(
        Object.entries(clusters).map(([k, v]) => [k, +((v / total) * 100).toFixed(1)]),
      ),
    },
    clusterStats: cluster.clusters,
    lifetimeGenealogy: genealogy,
    comparison,
    audit,
    verdict,
    auditTimeline: timeline,
    auditCoverage: input.auditCoverage,
  };
}
