import { HenrikDevError } from "./henrik-errors.ts";
import { MATCH_ID, type HDMatch } from "./henrik-model.ts";
import { hdMatchPlayers, normalizeHDMatch } from "./match-normalize.ts";

/** Store only ended, structurally complete data, not rounds/events/economy blobs. */
export function archivePayload(raw: HDMatch, id = raw.metadata?.matchid): string {
  if (hdMatchPlayers(raw).some((p) => ![p.stats?.score, p.stats?.kills, p.stats?.deaths]
    .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0))) {
    throw new HenrikDevError(502, "Missing match statistics");
  }
  const match = normalizeHDMatch(raw);
  const competitive = (match.metadata.mode_id || match.metadata.mode || "").toLowerCase() === "competitive";
  if (!MATCH_ID.test(id) || match.metadata.matchid !== id ||
    !(match.metadata.game_start > 0) || !(match.metadata.game_length > 0) ||
    match.players.length < 2 || match.players.length > 30 ||
    new Set(match.players.map((p) => p.puuid)).size !== match.players.length ||
    match.players.some((p) => !p.puuid || !p.character ||
      ![p.stats.kills, p.stats.deaths, p.stats.score].every((n) => Number.isFinite(n) && n >= 0)) ||
    (competitive && (match.players.length !== 10 ||
      match.players.filter((p) => p.team_id?.toLowerCase() === "red").length !== 5 ||
      match.players.filter((p) => p.team_id?.toLowerCase() === "blue").length !== 5 ||
      match.metadata.rounds_played !== (match.teams.red.rounds_won ?? 0) + (match.teams.blue.rounds_won ?? 0)))) {
    throw new HenrikDevError(502, "Incomplete match detail");
  }
  const players = hdMatchPlayers(raw).map((p) => ({
    puuid: p.puuid, name: p.name, tag: p.tag, team: p.team ?? p.team_id,
    character: p.character, currenttier: p.currenttier ?? p.tier, level: p.level,
    party_id: p.party_id, stats: p.stats, assets: p.assets,
    damage_made: p.damage_made, damage_received: p.damage_received,
    player_card: p.player_card, ability_casts: p.ability_casts,
  }));
  const payload = JSON.stringify({ metadata: raw.metadata, players, teams: raw.teams });
  if (new TextEncoder().encode(payload).length > 500_000) throw new HenrikDevError(502, "Match detail too large");
  return payload;
}
