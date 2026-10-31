import "server-only";
import {
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
      // 30 is the HenrikDev matchlist cap; the extra rows feed the
      // current-act / all-acts encounter counters on party members.
      const matches = await getMatches(region, puuid, { size: 30, fresh: true });
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
    renderMatchCard: async (match, watched) => {
      const { renderWatchCard } = await import("./watch-card");
      return renderWatchCard(match, watched);
    },
    sendWebhook: async (url, payload, files) => {
      let body: BodyInit;
      let headers: Record<string, string> | undefined;
      if (files?.length) {
        const form = new FormData();
        form.append("payload_json", JSON.stringify(payload));
        files.forEach((f, i) => {
          form.append(`files[${i}]`, new Blob([f.data.slice().buffer], { type: f.type }), f.name);
        });
        body = form;
      } else {
        headers = { "content-type": "application/json" };
        body = JSON.stringify(payload);
      }
      const res = await fetch(url, { method: "POST", headers, body });
      return res.ok;
    },
  };
}
