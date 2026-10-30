/**
 * Anonymous profile-search history in localStorage — no account needed.
 * Entries are recorded when a profile page actually renders, so failed
 * searches and never-visited players are never stored.
 */
export interface SearchHistoryEntry {
  name: string;
  tag: string;
  puuid?: string;
  /** Ready-to-render URLs (player card smallart, rank icon) built server-side. */
  card?: string;
  rankIcon?: string;
  rankName?: string;
  at: number;
}

const KEY = "kt_search_history";
const MAX = 10;

export function getSearchHistory(): SearchHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const arr: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (e): e is SearchHistoryEntry =>
          !!e &&
          typeof e === "object" &&
          typeof (e as SearchHistoryEntry).name === "string" &&
          typeof (e as SearchHistoryEntry).tag === "string" &&
          typeof (e as SearchHistoryEntry).at === "number",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function samePlayer(a: SearchHistoryEntry, b: SearchHistoryEntry): boolean {
  if (a.puuid && b.puuid) return a.puuid === b.puuid;
  return a.name.toLowerCase() === b.name.toLowerCase() &&
    a.tag.toLowerCase() === b.tag.toLowerCase();
}

export function recordSearch(entry: Omit<SearchHistoryEntry, "at">): void {
  if (typeof window === "undefined" || !entry.name || !entry.tag) return;
  try {
    const next = { ...entry, at: Date.now() };
    const list = getSearchHistory().filter((e) => !samePlayer(e, next));
    list.unshift(next);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable (private mode, quota) — history is best-effort */
  }
}

export function clearSearchHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
