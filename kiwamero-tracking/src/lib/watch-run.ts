import "server-only";
import {
  MAX_MATCHES_PER_RUN,
  runWatchCycle,
  type RawMatchForNotify,
  type WatchDb,
  type WatchDeps,
  type WatchSummary,
} from "./watch-core";

export { runWatchCycle };
export type { WatchDb, WatchDeps, WatchSummary };

/** Wired dependencies for the Next.js route (uses the app's env + fetch). */
export function createWatchDeps(): WatchDeps {
  return {
    resolvePlayer: async (riotName, riotTag) => {
      const { getAccount } = await import("./henrikdev");
      const account = await getAccount(riotName, riotTag);
      return { puuid: account.puuid, region: account.region };
    },
    fetchMatches: async (puuid, region) => {
      const { getMatches } = await import("./henrikdev");
      // Fresh fetch — a stale cached list could delay new-match notifications.
      const matches = await getMatches(region, puuid, { size: MAX_MATCHES_PER_RUN + 5, fresh: true });
      return matches as unknown as RawMatchForNotify[];
    },
    fetchSeasonStats: async (puuid, region, seasonId) => {
      if (!seasonId) return null;
      const { getStoredMatches } = await import("./henrikdev");
      const stored = await getStoredMatches(region, puuid);
      const rows = stored.filter((m) =>
        m.meta.season.id === seasonId || m.meta.season.short === seasonId,
      );
      if (!rows.length) return null;
      const kills = rows.reduce((sum, m) => sum + (m.stats.kills ?? 0), 0);
      const deaths = rows.reduce((sum, m) => sum + (m.stats.deaths ?? 0), 0);
      return {
        matches: rows.length,
        kills,
        deaths,
        kd: deaths ? kills / deaths : null,
        act: rows[0].meta.season.short || rows[0].meta.season.id,
      };
    },
    sendWebhook: async (url, payload) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    },
  };
}
