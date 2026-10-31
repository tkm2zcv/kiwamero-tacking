import { HenrikDevError } from "./henrik-client.ts";
import { beforeDeadline, DeadlineExceeded } from "./deadline.ts";
import type { HDAccount, HDMatch, HDMmrData, HDMmrHistoryEntry, HDStoredMatch } from "./henrik-model";

// Leave ~2 seconds for rendering and delivery within the 10-second UX target.
export const PROFILE_LOAD_BUDGET_MS = 8_000;
export type ProfileFailure = "not_found" | "private" | "rate_limited" | "upstream" | "timeout";
export type ProfileResource = "rating" | "recent" | "history" | "stored";
export interface ProfileIssue { resource: ProfileResource; reason: ProfileFailure }
export interface ProfileLoadOptions {
  mode?: string;
  includeRecentMatches?: boolean;
  includeStoredMatches?: boolean;
  deadline?: number;
  /** The response may finish first; the platform must keep shared reads alive. */
  background?: (completion: Promise<ProfileSourceResult>) => void;
}
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
  | { ok: true; data: ProfileSourceData; issues: ProfileIssue[] }
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
  opts?: ProfileLoadOptions,
): Promise<ProfileSourceResult> {
  const deadline = opts?.deadline ?? Date.now() + PROFILE_LOAD_BUDGET_MS;
  // Start once. Foreground deadline expiry never restarts/cancels these reads.
  const reads = sources.getAccount(name, tag).then((account) => {
    const { region, puuid } = account;
    const list = <T>(request: Promise<T[]>): Promise<T[]> => emptyOnNotFound(request, []).then((rows) => {
      if (!Array.isArray(rows)) throw new HenrikDevError(502, "Invalid profile history");
      return rows;
    });
    return {
      account,
      rating: emptyOnNotFound<HDMmrData | null>(sources.getMmr(region, puuid), null),
      recent: opts?.includeRecentMatches === false ? Promise.resolve([]) :
        list(sources.getMatches(region, puuid, { size: 25, mode: opts?.mode })),
      history: list(sources.getMmrHistory(region, puuid)),
      stored: opts?.includeStoredMatches === false ? Promise.resolve([]) :
        list(sources.getStoredMatches(region, puuid, { mode: opts?.mode })),
    };
  });
  async function collect(until?: number): Promise<ProfileSourceResult> {
    try {
      const group = await (until === undefined ? reads : beforeDeadline(reads, until));
      const issues: ProfileIssue[] = [];
      async function read<T>(resource: ProfileResource, task: Promise<T>, empty: T): Promise<T> {
        try { return await (until === undefined ? task : beforeDeadline(task, until)); }
        catch (error) { issues.push({ resource, reason: failureReason(error) }); return empty; }
      }
      const [mmr, hdMatches, history, storedMatches] = await Promise.all([
        read("rating", group.rating, null),
        read("recent", group.recent, []),
        read("history", group.history, []),
        read("stored", group.stored, []),
      ]);
      return { ok: true, data: { account: group.account, mmr, hdMatches, history, storedMatches }, issues };
    } catch (error) {
      return { ok: false, reason: failureReason(error) };
    }
  }
  // Attach handlers to every read immediately, including when identity is slow.
  const completion = collect();
  opts?.background?.(completion);
  return collect(deadline);
}

function failureReason(error: unknown): ProfileFailure {
  if (error instanceof DeadlineExceeded) return "timeout";
  const status = error instanceof HenrikDevError ? error.status : undefined;
  return status === 404 ? "not_found" :
    status === 401 || status === 403 ? "private" :
    status === 429 ? "rate_limited" : "upstream";
}
