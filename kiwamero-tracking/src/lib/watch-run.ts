import "server-only";
import {
  normalizeDiscordWebhook,
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
      const account = await getAccount(riotName, riotTag, { priority: "background" });
      return { puuid: account.puuid, region: account.region };
    },
    fetchMatches: async (puuid, region) => {
      const { getMatches } = await import("./henrikdev");
      // Fresh fetch — a stale cached list could delay new-match notifications.
      // 30 is the HenrikDev matchlist cap; the extra rows feed the
      // current-act / all-acts encounter counters on party members.
      const matches = await getMatches(region, puuid, { size: 30, fresh: true, priority: "background" });
      return matches as unknown as RawMatchForNotify[];
    },
    fetchSeasonStats: async (puuid, region, seasonId) => {
      if (!seasonId) return null;
      const { getStoredMatches } = await import("./henrikdev");
      const stored = await getStoredMatches(region, puuid, { priority: "background" });
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
      // Re-validate at send time: a stored URL may predate the write-time rules,
      // and redirects must never carry the payload to another host.
      const safeUrl = normalizeDiscordWebhook(url);
      if (!safeUrl) return false;
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
      // Workerd rejects redirect:"error"; manual keeps the payload on this host
      // and res.ok rejects all redirect responses without following Location.
      const res = await fetch(safeUrl, { method: "POST", headers, body, redirect: "manual" });
      return res.ok;
    },
  };
}
