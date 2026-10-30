// HenrikDev unofficial VALORANT API client (server-only).
// Request budgets are configurable; defaults match the observed Standard plan.

import { HenrikDevError, henrikCall } from "./henrik-client.ts";
import { archivedMatch, rememberMatch } from "./match-archive.ts";
import type { HDAccount, HDMatch, HDMmrData, HDMmrHistoryEntry, HDStoredMatch } from "./henrik-model";

export { tierIcon, tierName, playerCardArt, normalizeCluster } from "./henrik-shared.ts";
export type { HDAccount, HDMatch, HDMatchPlayer, HDMmrData, HDMmrHistoryEntry, HDStoredMatch } from "./henrik-model";

// HTTP layer (cache, in-flight dedupe, key rotation) lives in henrik-client.ts.
// TTLs below keep every tab/page re-render free of upstream calls within the
// window; `fresh` bypasses for callers that need the newest data (watch cycle).
export { HenrikDevError };

const TTL_ACCOUNT = 600_000;
const TTL_MMR = 180_000;
const TTL_MMR_HISTORY = 600_000;
const TTL_MATCHES = 300_000;
const TTL_STORED_MATCHES = 300_000;

const call = henrikCall;

export async function getAccount(name: string, tag: string, opts?: { fresh?: boolean }) {
  return call<HDAccount>(
    `/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    { ttl: TTL_ACCOUNT, fresh: opts?.fresh },
  );
}

export async function getMmr(region: string, puuid: string, opts?: { fresh?: boolean }) {
  return call<HDMmrData>(
    `/valorant/v2/by-puuid/mmr/${region}/${puuid}`,
    { ttl: TTL_MMR, fresh: opts?.fresh },
  );
}

export async function getMatches(region: string, puuid: string, opts?: { mode?: string; size?: number; fresh?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.mode) params.set("mode", opts.mode);
  if (opts?.size) params.set("size", String(opts.size));
  const q = params.toString();
  const matches = await call<HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}${q ? `?${q}` : ""}`,
    { ttl: TTL_MATCHES, fresh: opts?.fresh }
  );
  await Promise.allSettled(matches.map(rememberMatch));
  return matches;
}

export async function getStoredMatches(region: string, puuid: string, opts?: { mode?: string; fresh?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.mode) params.set("mode", opts.mode);
  const q = params.toString();
  return call<HDStoredMatch[]>(
    `/valorant/v1/by-puuid/stored-matches/${region}/${puuid}${q ? `?${q}` : ""}`,
    { ttl: TTL_STORED_MATCHES, fresh: opts?.fresh }
  );
}

export async function getMmrHistory(region: string, puuid: string, opts?: { fresh?: boolean }) {
  return call<HDMmrHistoryEntry[]>(
    `/valorant/v1/by-puuid/mmr-history/${region}/${puuid}`,
    { ttl: TTL_MMR_HISTORY, fresh: opts?.fresh },
  );
}

/** Ended-match roster/stats, reused from D1; round/event blobs are not archived. */
export async function getMatch(matchId: string, opts?: { fresh?: boolean; priority?: "interactive" | "background" }) {
  return archivedMatch(matchId, () => call<HDMatch>(
    `/valorant/v2/match/${matchId}`,
    { ttl: 0, fresh: opts?.fresh, priority: opts?.priority },
  ), opts?.fresh);
}

export async function getLifetimeMatchesCount(region: string, puuid: string) {
  const data = await call<{ total?: number } | HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}?size=1`,
    { ttl: TTL_MATCHES },
  );
  return Array.isArray(data) ? data.length : (data.total ?? 0);
}
