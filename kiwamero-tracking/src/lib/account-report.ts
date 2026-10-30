/**
 * Builds the shared AccountReport powering the Account Audit (アカウント査定)
 * and Smurf Diagnosis (スマーフ診断) tabs. Lifetime evidence comes from the
 * stored match history; lobby-level reads come from sampled full rosters.
 */
import type { Locale } from "./i18n/dict";
import type { Match, Profile, SeasonRank } from "./types";
import type { StoredRow } from "./stored-stats";
import { aggregate } from "./stored-stats.ts";
import {
  buildClusterEvidence, buildGenealogy, buildHistory, earlyRecentComparison, statBlock,
} from "./report-evidence.ts";
import { scoreAudit } from "./audit-score.ts";
import { analyzeLobby } from "./lobby-analysis.ts";
import { buildVerdict } from "./smurf-verdict.ts";
import type { AccountReport } from "./report-model";

export type { AccountReport } from "./report-model";

export function buildAccountReport(input: {
  profile: Pick<Profile, "name" | "tag" | "puuid" | "level" | "region" | "currentTier" | "currentRank">;
  seasons: SeasonRank[];
  storedAll: StoredRow[];
  /** Full-roster competitive matches (v3 recent + fetched details). */
  rosterMatches: Match[];
  locale: Locale;
  generatedAt: string;
}): AccountReport {
  const { profile, seasons, storedAll, rosterMatches, locale, generatedAt } = input;
  const self = { name: profile.name, tag: profile.tag };

  const comparison = earlyRecentComparison(storedAll);
  const genealogy = buildGenealogy(storedAll, self);
  const cluster = buildClusterEvidence(storedAll);
  cluster.hasClusterFlip = genealogy.hasClusterFlip;
  const history = buildHistory(seasons, storedAll);

  const audit = scoreAudit({
    locale, history, cluster, comparison, genealogy,
    currentTier: profile.currentTier,
  });

  const agg = aggregate(storedAll);
  const topAgents = statBlock(storedAll).topAgents;
  const lobby = analyzeLobby(
    rosterMatches, `${profile.name}#${profile.tag}`, topAgents, locale,
  );
  const verdict = buildVerdict({
    locale,
    currentTier: profile.currentTier,
    currentRankName: profile.currentRank || "Unrated",
    level: profile.level,
    role: lobby.role,
    lobby,
    playerStats: { hs: agg.hs, kd: agg.kd, acs: agg.acs, winRate: agg.winRate },
    audit,
    storedTotal: storedAll.length,
    rosterMatches,
    spanMonths: genealogy.lifetimeSpanMonths,
  });

  const clusters = genealogy.lifetimeClusterBreakdown;
  const total = storedAll.length || 1;
  return {
    generatedAt,
    sample: {
      storedMatches: storedAll.length,
      rosterMatches: rosterMatches.length,
      competitiveRows: storedAll.filter((r) => /competitive/i.test(r.mode)).length,
    },
    history,
    serverStats: {
      total: storedAll.length,
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
  };
}
