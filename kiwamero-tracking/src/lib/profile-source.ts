import { HenrikDevError } from "./henrik-client.ts";
import type { HDAccount, HDMatch, HDMmrData, HDMmrHistoryEntry, HDStoredMatch } from "./henrik-model";

export type ProfileFailure = "not_found" | "private" | "rate_limited" | "upstream";
export type ProfileSources = Pick<typeof import("./henrikdev"),
  "getAccount" | "getMmr" | "getMatches" | "getMmrHistory" | "getStoredMatches">;

export interface ProfileSourceData {
  account: HDAccount;
  mmr: HDMmrData | null;
  hdMatches: HDMatch[];
  history: HDMmrHistoryEntry[];
  storedMatches: HDStoredMatch[];
}

export type ProfileSourceResult =
  | { ok: true; data: ProfileSourceData }
  | { ok: false; reason: ProfileFailure };

/** Only a genuine missing history/rating is empty; permission, quota and network failures are not. */
async function emptyOnNotFound<T>(request: Promise<T>, empty: T): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof HenrikDevError && error.status === 404) return empty;
    throw error;
  }
}

export async function loadProfileSource(
  sources: ProfileSources,
  name: string,
  tag: string,
  opts?: { mode?: string; includeRecentMatches?: boolean; includeStoredMatches?: boolean },
): Promise<ProfileSourceResult> {
  try {
    const account = await sources.getAccount(name, tag);
    const { region, puuid } = account;
    const recent = opts?.includeRecentMatches !== false;
    const stored = opts?.includeStoredMatches !== false;
    const [mmr, hdMatches, history, storedMatches] = await Promise.all([
      emptyOnNotFound<HDMmrData | null>(sources.getMmr(region, puuid), null),
      recent ? emptyOnNotFound(sources.getMatches(region, puuid, { size: 25, mode: opts?.mode }), []) : Promise.resolve([]),
      emptyOnNotFound(sources.getMmrHistory(region, puuid), []),
      stored ? emptyOnNotFound(sources.getStoredMatches(region, puuid, { mode: opts?.mode }), []) : Promise.resolve([]),
    ]);
    if (![hdMatches, history, storedMatches].every(Array.isArray)) {
      throw new HenrikDevError(502, "Invalid profile history");
    }
    return { ok: true, data: { account, mmr, hdMatches, history, storedMatches } };
  } catch (error) {
    const status = error instanceof HenrikDevError ? error.status : undefined;
    const reason = status === 404 ? "not_found" :
      status === 401 || status === 403 ? "private" :
      status === 429 ? "rate_limited" : "upstream";
    return { ok: false, reason };
  }
}
