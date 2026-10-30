import type { HDMatch } from "../src/lib/henrikdev";
import type { StoredRow } from "../src/lib/stored-stats";

export const selfId = "10000000-0000-4000-8000-000000000001";
export const matchId = (i: number) => `20000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
export function stored(i: number, over: Partial<StoredRow> = {}): StoredRow {
  return {
    id: matchId(i), map: "Ascent", mapId: "", mode: "Competitive",
    startedAt: Date.parse("2026-09-01T00:00:00Z") / 1000 + i * 3600,
    day: "", seasonId: "season", seasonShort: "e11a6", agent: "Jett", agentId: "",
    tier: 12, kills: 12, deaths: 12, assists: 3, score: 4800,
    head: 8, body: 14, leg: 2, dmgMade: 1000, dmgRecv: 1000,
    rounds: 24, won: 13, lost: 11, result: "win", cluster: "Tokyo",
    selfName: "Player", selfTag: "TAG", level: 100, ...over,
  };
}
export function rawMatch(i: number): HDMatch {
  return {
    metadata: { matchid: matchId(i), map: "Ascent", game_start: stored(i).startedAt,
      game_length: 2000000, rounds_played: 24, mode: "Competitive", mode_id: "competitive" },
    teams: { red: { has_won: true, rounds_won: 13, rounds_lost: 11 },
      blue: { has_won: false, rounds_won: 11, rounds_lost: 13 } },
    players: Array.from({ length: 10 }, (_, n) => ({
      puuid: n ? `30000000-0000-4000-8000-${String(n).padStart(12, "0")}` : selfId,
      name: `Player${n}`, tag: "TAG", team: n < 5 ? "Red" : "Blue",
      character: "Jett", currenttier: 12, party_id: n < 5 ? "red-party" : "blue-party",
      stats: { kills: 12, deaths: 12, assists: 3, score: 4800, headshots: 8, bodyshots: 14, legshots: 2 },
      assets: {},
    })),
  } as HDMatch;
}
