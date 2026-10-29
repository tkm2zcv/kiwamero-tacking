import type { Match, MatchPlayer } from "./types";
import type { HDMatch, HDMatchPlayer } from "./henrikdev";

/** v3 returns `{ all_players, red, blue }`; some endpoints return a flat array. */
export function hdMatchPlayers(m: Pick<HDMatch, "players">): HDMatchPlayer[] {
  const pl = m.players;
  if (Array.isArray(pl)) return pl;
  return pl?.all_players ?? [];
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
  return {
    metadata: {
      map: typeof m.metadata.map === "string" ? m.metadata.map : m.metadata.map.name,
      game_length: m.metadata.game_length ?? 0,
      game_start: m.metadata.game_start,
      game_start_patched: m.metadata.game_start_patched,
      rounds_played: m.metadata.rounds_played,
      mode: m.metadata.mode,
      mode_id: m.metadata.mode_id,
      queue: m.metadata.queue,
      season_id: m.metadata.season_id,
      platform: m.metadata.platform,
      matchid: m.metadata.matchid,
      region: m.metadata.region,
      cluster: m.metadata.cluster,
    },
    teams: {
      red: {
        has_won: m.teams.red?.has_won ?? m.teams.red?.won ?? false,
        rounds_won: m.teams.red?.rounds_won ?? m.teams.red?.rounds?.won ?? 0,
        rounds_lost: m.teams.red?.rounds_lost ?? m.teams.red?.rounds?.lost ?? 0,
      },
      blue: {
        has_won: m.teams.blue?.has_won ?? m.teams.blue?.won ?? false,
        rounds_won: m.teams.blue?.rounds_won ?? m.teams.blue?.rounds?.won ?? 0,
        rounds_lost: m.teams.blue?.rounds_lost ?? m.teams.blue?.rounds?.lost ?? 0,
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
