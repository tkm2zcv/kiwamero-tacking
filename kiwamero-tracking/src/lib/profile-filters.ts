import type { Match } from "./types";
import { MATCH_ID } from "./henrik-model.ts";

/**
 * Playlist filter options. HenrikDev names differ per endpoint — v3/v4 expose
 * `mode_id` ("hurm", "skirmish_2v2", "abilitydraftarena") while stored-matches
 * exposes display names ("Team Deathmatch", "Gauntlet: Glitched") — so every
 * comparison goes through `canonicalMatchMode`.
 */
export const PLAYLISTS = [
  { slug: "competitive", label: "Competitive" },
  { slug: "premier", label: "Premier" },
  { slug: "unrated", label: "Unrated" },
  { slug: "deathmatch", label: "Deathmatch" },
  { slug: "swiftplay", label: "Swiftplay" },
  { slug: "teamdeathmatch", label: "Team Deathmatch" },
  { slug: "custom", label: "Custom" },
  { slug: "gauntlet", label: "Gauntlet" },
  { slug: "spikerush", label: "Spike Rush" },
  { slug: "escalation", label: "Escalation" },
  { slug: "replication", label: "Replication" },
  { slug: "snowball", label: "Snowball" },
] as const;

export const PLAYLIST_PARAM_SET: ReadonlySet<string> = new Set([
  ...PLAYLISTS.map((m) => m.slug), "all",
]);

/** Only high-volume modes narrow the upstream fetch; the rest share the "all" snapshot. */
const UPSTREAM_MODE_SLUGS: ReadonlySet<string> = new Set(
  PLAYLISTS.slice(0, 5).map((m) => m.slug),
);
export function playlistUpstreamMode(playlist: string): string | undefined {
  return UPSTREAM_MODE_SLUGS.has(playlist) ? playlist : undefined;
}

const MODE_ALIASES: Record<string, string> = {
  hurm: "teamdeathmatch",
  skirmish: "teamdeathmatch",
  skirmishv: "teamdeathmatch",
  customgame: "custom",
  abilitydraftarena: "gauntlet",
  gauntletglitched: "gauntlet",
  snowballfight: "snowball",
};

/** Canonical playlist slug for a HenrikDev mode_id or stored display name. */
export function canonicalMatchMode(raw: string | null | undefined): string {
  const norm = (raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return MODE_ALIASES[norm] ?? norm;
}

export function playlistModeLabel(slug: string): string {
  return PLAYLISTS.find((m) => m.slug === slug)?.label ??
    slug.charAt(0).toUpperCase() + slug.slice(1);
}

/** Acquisition is account-wide; changing an Act/playlist must not queue old games. */
export function recentEncounterIds(rows: ReadonlyArray<{ id: string; startedAt: number }>): string[] {
  return [...new Set(rows.filter((r) => MATCH_ID.test(r.id) && Number.isFinite(r.startedAt) && r.startedAt > 0)
    .sort((a, b) => b.startedAt - a.startedAt || a.id.localeCompare(b.id))
    .map((r) => r.id))];
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
    (playlist === "all" || canonicalMatchMode(m.metadata.mode_id || m.metadata.mode) === playlist) &&
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
