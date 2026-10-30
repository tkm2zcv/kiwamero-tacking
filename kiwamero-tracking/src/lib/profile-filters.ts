import type { Match } from "./types";

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

/**
 * Pick stored match ids whose rosters still need a /v2/match/{id} detail fetch
 * for encounters — newest first, skipping matches already covered by the recent
 * v3 response, capped so one render stays within upstream rate limits.
 */
export function selectUncoveredMatchIds(
  rows: ReadonlyArray<{ id?: string; startedAt: number }>,
  coveredIds: ReadonlySet<string>,
  cap: number,
): string[] {
  return rows
    .filter((r) => r.id && !coveredIds.has(r.id))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, Math.max(0, cap))
    .map((r) => r.id!);
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
