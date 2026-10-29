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
