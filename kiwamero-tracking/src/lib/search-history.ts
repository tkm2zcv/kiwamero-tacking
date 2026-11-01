/**
 * Anonymous profile-search history in localStorage — no account needed.
 * Only players the user actually searched for are stored: a search marks an
 * intent in sessionStorage, and the profile render consumes it — so failed
 * searches, direct URL visits, and link clicks never land in history.
 */
import { isPuuid } from "./player-search.ts";

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

const INTENT_KEY = "kt_search_intent";

/** Mark that the user just searched for name#tag from a search UI. */
export function markSearchIntent(name: string, tag: string): void {
  if (typeof window === "undefined" || !name || !tag) return;
  try {
    window.sessionStorage.setItem(INTENT_KEY, JSON.stringify({ name, tag }));
  } catch {
    /* storage unavailable — history is best-effort */
  }
}

export function markPuuidSearchIntent(puuid: string): void {
  if (typeof window === "undefined" || !isPuuid(puuid)) return;
  try {
    window.sessionStorage.setItem(INTENT_KEY, JSON.stringify({ puuid: puuid.toLowerCase() }));
  } catch { /* History is best-effort when storage is unavailable. */ }
}

/** True (and clears the marker) when this render fulfills a pending search. */
export function consumeSearchIntent(name: string, tag: string, puuid?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(INTENT_KEY);
    if (!raw) return false;
    const intent = JSON.parse(raw) as { name?: unknown; tag?: unknown; puuid?: unknown };
    const match = typeof intent.puuid === "string"
      ? isPuuid(intent.puuid) && intent.puuid.toLowerCase() === puuid?.toLowerCase()
      : typeof intent.name === "string" &&
      typeof intent.tag === "string" &&
      intent.name.toLowerCase() === name.toLowerCase() &&
      intent.tag.toLowerCase() === tag.toLowerCase();
    if (match) window.sessionStorage.removeItem(INTENT_KEY);
    return match;
  } catch {
    return false;
  }
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
