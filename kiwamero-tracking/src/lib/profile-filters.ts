import type { Match } from "./types";
import { MATCH_ID } from "./henrik-model.ts";

export const ENCOUNTER_RECENT_LIMIT = 50;

/** Acquisition is account-wide; changing an Act/playlist must not queue old games. */
export function recentEncounterIds(rows: ReadonlyArray<{ id: string; startedAt: number }>): string[] {
  return [...new Set(rows.filter((r) => MATCH_ID.test(r.id) && Number.isFinite(r.startedAt) && r.startedAt > 0)
    .sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id))
    .map((r) => r.id))].slice(0, ENCOUNTER_RECENT_LIMIT);
}

export function createActFilter(
  act: string,
  seasonUuid: ReadonlyMap<string, string>,
  uuidToShort: ReadonlyMap<string, string>,
  latestStoredSeason: string,
) {
  const selected = act.toLowerCase();
  const short = /^e\d+a\d+$/.test(selected) ? selected : uuidToShort.get(selected);
  const uuid = short ? seasonUuid.get(short) : selected;
  return (seasonId?: string, seasonShort?: string): boolean => {
    if (selected === "all") return true;
    if (selected === "latest") return !!latestStoredSeason && seasonId === latestStoredSeason;
    return (!!uuid && seasonId?.toLowerCase() === uuid.toLowerCase()) ||
      (!!short && seasonShort?.toLowerCase() === short);
  };
}

export function filterProfileMatches(
  matches: Match[],
  playlist: string,
  inAct: (id?: string, short?: string) => boolean,
  uuidToShort: ReadonlyMap<string, string>,
): Match[] {
  return matches.filter((m) =>
    (playlist === "all" || m.metadata.mode_id.toLowerCase().replace(/[^a-z]/g, "") === playlist) &&
    inAct(m.metadata.season_id, uuidToShort.get(m.metadata.season_id?.toLowerCase() ?? "")),
  );
}

export function profileFilterHref(
  basePath: string,
  tab: string,
  playlist: string,
  act: string,
  played?: "with" | "against",
): string {
  const query = new URLSearchParams({ platform: "pc", playlist, season: act });
  if (tab === "encounters" && played === "against") query.set("played", played);
  return `${basePath}/${tab}?${query}`;
}
