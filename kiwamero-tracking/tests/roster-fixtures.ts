import { rawMatch } from "./history-fixtures.ts";

export function v4Match(i: number) {
  const raw = rawMatch(i);
  const players = Array.isArray(raw.players) ? raw.players : raw.players.all_players;
  return {
    metadata: {
      match_id: raw.metadata.matchid, map: { id: "map", name: "Ascent" },
      started_at: new Date(raw.metadata.game_start * 1000).toISOString(),
      game_length_in_ms: raw.metadata.game_length, game_version: "test",
      is_completed: true, queue: { id: "competitive", name: "Competitive" },
      season: { id: "season", short: "e11a6" }, region: "ap", platform: "pc", cluster: "Tokyo",
    },
    players: players.map((p) => ({
      puuid: p.puuid, name: p.name, tag: p.tag, team_id: p.team,
      party_id: p.party_id, account_level: 100, agent: { id: "agent", name: p.character },
      tier: { id: p.currenttier, name: "Gold 1" }, customization: { card: "card" },
      stats: { ...p.stats, damage: { dealt: 1000, received: 900 } },
    })),
    teams: ["Red", "Blue"].map((id) => ({
      team_id: id, won: id === "Red",
      rounds: { won: id === "Red" ? 13 : 11, lost: id === "Red" ? 11 : 13 },
    })),
  };
}
