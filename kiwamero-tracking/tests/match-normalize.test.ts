import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHDMatch } from "../src/lib/match-normalize.ts";
import type { HDMatch } from "../src/lib/henrikdev.ts";
import { tierName } from "../src/lib/henrikdev.ts";

test("tierName uses Riot's tier numbering for every ranked division", () => {
  const groups = ["Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal"];
  for (const [index, group] of groups.entries()) {
    for (let division = 1; division <= 3; division++) {
      assert.equal(tierName(3 + index * 3 + division - 1), `${group} ${division}`);
    }
  }
  assert.equal(tierName(27), "Radiant");
  assert.equal(tierName(0), "");
  assert.equal(tierName(99), "");
});

function hd(overrides: Record<string, unknown> = {}): HDMatch {
  return {
    metadata: {
      matchid: "m1",
      map: "Sunset",
      game_version: "release-10",
      game_length: 2400,
      game_start: 1_700_000_000,
      game_start_patched: "Oct 27",
      rounds_played: 24,
      mode: "Competitive",
      mode_id: "competitive",
      queue: "competitive",
      season_id: "season-1",
      platform: "pc",
      premier_info: null,
      region: "ap",
      cluster: "ap",
    },
    players: {
      all_players: [
        {
          puuid: "p1",
          name: "Meiy",
          tag: "B3L",
          team: "Red",
          level: 926,
          character: "Jett",
          currenttier: 27,
          currenttier_patched: "Radiant",
          player_card: "card-1",
          stats: {
            score: 4800,
            kills: 20,
            deaths: 15,
            assists: 4,
            headshots: 10,
            bodyshots: 20,
            legshots: 5,
            damage: 4000,
            c_casts: 3,
            q_casts: 4,
            e_casts: 5,
            x_casts: 1,
          },
          damage_made: 4100,
          damage_received: 3200,
          assets: { agent: { small: "jett.png" } },
        },
      ],
      red: [],
      blue: [],
    },
    teams: {
      red: { has_won: true, rounds_won: 13, rounds_lost: 9 },
      blue: { has_won: false, rounds_won: 9, rounds_lost: 13 },
    },
    ...overrides,
  } as unknown as HDMatch;
}

test("normalizeHDMatch flattens players and keeps team/round data", () => {
  const m = normalizeHDMatch(hd());
  assert.equal(m.metadata.map, "Sunset");
  assert.equal(m.metadata.matchid, "m1");
  assert.equal(m.teams.red.has_won, true);
  assert.equal(m.teams.red.rounds_won, 13);
  assert.equal(m.players.length, 1);
  assert.equal(m.players[0].team_id, "Red");
  assert.equal(m.players[0].currenttier_patched, "Radiant");
  assert.equal(m.players[0].damage_made, 4100);
  assert.deepEqual(m.players[0].ability_casts, { c: 3, q: 4, e: 5, x: 1 });
});

test("normalizeHDMatch handles map objects and flat player arrays", () => {
  const m = normalizeHDMatch(hd({
    metadata: {
      matchid: "m2",
      map: { id: "x", name: "Lotus" },
      game_length: 1800,
      game_start: 1_700_000_100,
      game_start_patched: "",
      rounds_played: 1,
      mode: "Deathmatch",
      mode_id: "deathmatch",
      queue: "deathmatch",
      season_id: "s",
      platform: "pc",
      region: "ap",
      cluster: "ap",
    },
    players: [
      {
        puuid: "p1",
        name: "Meiy",
        tag: "B3L",
        level: 926,
        character: "Jett",
        stats: { score: 40, kills: 40, deaths: 27, assists: 0, damage: 5000 },
      },
    ],
    teams: { red: { rounds: { won: 13, lost: 11 } }, blue: {} },
  }));
  assert.equal(m.metadata.map, "Lotus");
  assert.equal(m.metadata.rounds_played, 1);
  assert.equal(m.players[0].damage_made, 5000);
  assert.equal(m.players[0].team_id, undefined);
  assert.equal(m.teams.red.rounds_won, 13);
});

test("normalizeHDMatch tolerates missing optional fields", () => {
  const m = normalizeHDMatch(hd({
    metadata: { matchid: "m3", map: "Bind", game_start: 1, mode: "Custom", mode_id: "custom", season_id: "s", platform: "pc", region: "ap", cluster: "ap" },
    players: { all_players: [{ puuid: "p", name: "a", tag: "b", character: "Omen", stats: { score: 1, kills: 1, deaths: 1, assists: 0 } }] },
    teams: {},
  }));
  assert.equal(m.metadata.game_length, 0);
  assert.equal(m.teams.blue.rounds_won, 0);
  assert.equal(m.players[0].damage_made, undefined);
  assert.equal(m.players[0].ability_casts, undefined);
});
