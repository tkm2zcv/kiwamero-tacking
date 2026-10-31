import type { Match, MatchPlayer } from "./types";
import { normalizeCluster } from "./henrik-shared.ts";
import type { HDMatch, HDMatchPlayer } from "./henrik-model";
import { HenrikDevError } from "./henrik-errors.ts";

/** v3 returns `{ all_players, red, blue }`; some endpoints return a flat array. */
export function hdMatchPlayers(m: Pick<HDMatch, "players"> | null | undefined): HDMatchPlayer[] {
  const pl = m?.players;
  const players = Array.isArray(pl) ? pl : pl?.all_players;
  return Array.isArray(players) ? players : [];
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** HTTP 200 does not guarantee a usable match: the provider can return null placeholders. */
function readableMatch(value: unknown): value is HDMatch {
  if (!record(value) || !record(value.metadata)) return false;
  const meta = value.metadata;
  const map = typeof meta.map === "string" ? meta.map : record(meta.map) ? meta.map.name : null;
  if (typeof meta.matchid !== "string" || !meta.matchid.trim() ||
      typeof map !== "string" || !map.trim() ||
      typeof meta.game_start !== "number" || !Number.isFinite(meta.game_start) || meta.game_start <= 0) return false;
  for (const key of ["game_length", "rounds_played"]) {
    if (meta[key] != null && (typeof meta[key] !== "number" || !Number.isFinite(meta[key]) || meta[key] < 0)) return false;
  }
  for (const key of ["mode", "mode_id", "queue", "season_id", "platform", "region", "cluster", "game_start_patched"]) {
    if (meta[key] != null && typeof meta[key] !== "string") return false;
  }
  const players = Array.isArray(value.players) ? value.players :
    record(value.players) ? value.players.all_players : null;
  if (!Array.isArray(players) || !players.length || !players.every((p) => {
    if (!record(p) || !record(p.stats)) return false;
    const stats = p.stats;
    return typeof p.puuid === "string" && !!p.puuid &&
      typeof p.name === "string" && typeof p.tag === "string" &&
      typeof p.character === "string" && !!p.character &&
      (p.team == null || typeof p.team === "string") && (p.team_id == null || typeof p.team_id === "string") &&
      ["score", "kills", "deaths", "assists"].every((key) =>
        typeof stats[key] === "number" && Number.isFinite(stats[key]) && stats[key] >= 0);
  })) return false;
  if (value.teams != null && !record(value.teams)) return false;
  const competitive = String(meta.mode_id || meta.mode || "").toLowerCase() === "competitive";
  if (competitive && (!record(value.teams) || !record(value.teams.red) || !record(value.teams.blue))) return false;
  return true;
}

/** Skip only structurally unavailable rows; never turn missing player statistics into zeroes. */
export function normalizeHDMatches(raw: unknown): { matches: Match[]; unavailable: number } {
  if (!Array.isArray(raw)) throw new HenrikDevError(502, "Invalid match history");
  const matches: Match[] = [];
  let unavailable = 0;
  for (const row of raw) {
    if (!readableMatch(row)) { unavailable++; continue; }
    matches.push(normalizeHDMatch(row));
  }
  return { matches, unavailable };
}

/**
 * Normalize a HenrikDev match into the app shape.
 *
 * Field names differ from the public docs; these were verified against live
 * responses: `players` is an object with `all_players`, the player's team is
 * `team` ("Red"/"Blue", absent in FFA), wins live in `teams.*.has_won`, damage is
 * `damage_made`/`damage_received` at the player level and ability casts use
 * `c_cast`-style keys.
 */
export function normalizeHDMatch(m: HDMatch): Match {
  if (!readableMatch(m)) throw new HenrikDevError(502, "Incomplete match data");
  return {
    metadata: {
      map: typeof m.metadata.map === "string" ? m.metadata.map : m.metadata.map.name,
      game_length: m.metadata.game_length ?? 0,
      game_start: m.metadata.game_start,
      game_start_patched: m.metadata.game_start_patched ?? "",
      rounds_played: m.metadata.rounds_played ?? 0,
      mode: m.metadata.mode ?? "",
      mode_id: m.metadata.mode_id ?? "",
      queue: m.metadata.queue,
      season_id: m.metadata.season_id ?? "",
      platform: m.metadata.platform ?? "",
      matchid: m.metadata.matchid,
      region: m.metadata.region ?? "",
      cluster: normalizeCluster(m.metadata.cluster),
    },
    teams: {
      red: {
        has_won: m.teams?.red?.has_won ?? m.teams?.red?.won ?? false,
        rounds_won: m.teams?.red?.rounds_won ?? m.teams?.red?.rounds?.won ?? 0,
        rounds_lost: m.teams?.red?.rounds_lost ?? m.teams?.red?.rounds?.lost ?? 0,
      },
      blue: {
        has_won: m.teams?.blue?.has_won ?? m.teams?.blue?.won ?? false,
        rounds_won: m.teams?.blue?.rounds_won ?? m.teams?.blue?.rounds?.won ?? 0,
        rounds_lost: m.teams?.blue?.rounds_lost ?? m.teams?.blue?.rounds?.lost ?? 0,
      },
    },
    players: hdMatchPlayers(m).map((p): MatchPlayer => ({
      puuid: p.puuid,
      name: p.name,
      tag: p.tag,
      team_id: p.team ?? p.team_id,
      level: p.level,
      character: p.character,
      currenttier: p.currenttier ?? p.tier,
      currenttier_patched: p.currenttier_patched,
      player_card: p.player_card,
      party_id: p.party_id,
      stats: {
        score: p.stats.score ?? 0,
        kills: p.stats.kills ?? 0,
        deaths: p.stats.deaths ?? 0,
        assists: p.stats.assists ?? 0,
        headshots: p.stats.headshots,
        bodyshots: p.stats.bodyshots,
        legshots: p.stats.legshots,
      },
      damage_made: p.damage_made ?? p.stats.damage,
      damage_received: p.damage_received,
      ability_casts: p.ability_casts ?? (p.stats.c_casts !== undefined
        ? Object.fromEntries(
            Object.entries({
              c: p.stats.c_casts, q: p.stats.q_casts, e: p.stats.e_casts, x: p.stats.x_casts,
            }).filter((e): e is [string, number] => e[1] !== undefined)
          )
        : undefined),
      assets: p.assets,
    })),
    rounds: m.rounds,
  };
}
