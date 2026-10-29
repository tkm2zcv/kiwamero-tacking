import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveAccuracy,
  deriveMaps,
  deriveMatchRows,
  deriveOverview,
  deriveRoles,
  formatAct,
  groupByDay,
  playtimeLabel,
  timeAgo,
} from "../src/lib/profile-stats.ts";
import type { Match } from "../src/lib/types.ts";

const ME = "me-puuid";

function match(overrides: {
  matchid: string;
  map?: string;
  character?: string;
  won?: boolean;
  rounds?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  score?: number;
  damageMade?: number;
  damageReceived?: number;
  headshots?: number;
  bodyshots?: number;
  legshots?: number;
  game_start?: number;
  game_length?: number;
  mode?: string;
}): Match {
  const rounds = overrides.rounds ?? 24;
  const won = overrides.won ?? true;
  return {
    metadata: {
      map: overrides.map ?? "Sunset",
      game_length: overrides.game_length ?? 2400,
      game_start: overrides.game_start ?? 1_700_000_000,
      game_start_patched: "",
      rounds_played: rounds,
      mode: overrides.mode ?? "Competitive",
      mode_id: (overrides.mode ?? "competitive").toLowerCase(),
      queue: "competitive",
      season_id: "s1",
      platform: "pc",
      matchid: overrides.matchid,
      region: "ap",
      cluster: "ap",
    },
    teams: {
      red: { has_won: won, rounds_won: won ? 13 : 9, rounds_lost: won ? 9 : 13 },
      blue: { has_won: !won, rounds_won: won ? 9 : 13, rounds_lost: won ? 13 : 9 },
    },
    players: [
      {
        puuid: ME,
        name: "Meiy",
        tag: "B3L",
        team_id: "red",
        character: overrides.character ?? "Jett",
        stats: {
          score: overrides.score ?? 4800,
          kills: overrides.kills ?? 20,
          deaths: overrides.deaths ?? 15,
          assists: overrides.assists ?? 4,
          headshots: overrides.headshots ?? 20,
          bodyshots: overrides.bodyshots ?? 30,
          legshots: overrides.legshots ?? 10,
        },
        damage_made: overrides.damageMade ?? 4000,
        damage_received: overrides.damageReceived ?? 3000,
      },
      {
        puuid: "opponent",
        name: "Other",
        tag: "1234",
        team_id: "blue",
        character: "Omen",
        stats: { score: 3000, kills: 15, deaths: 20, assists: 6 },
      },
    ],
  };
}

test("formatAct maps Riot season codes to the displayed label", () => {
  assert.equal(formatAct("e11a6"), "V26: A6");
  assert.equal(formatAct("e11a1"), "V26: A1");
  assert.equal(formatAct("e10a3"), "V25: A3");
  assert.equal(formatAct("e9a3"), "E9: A3");
  assert.equal(formatAct(undefined), "Latest");
  assert.equal(formatAct("weird"), "WEIRD");
});

test("timeAgo formats minutes, hours, days and weeks", () => {
  const now = 1_700_000_000_000;
  assert.equal(timeAgo(1_700_000_000 - 120, now), "2m ago");
  assert.equal(timeAgo(1_700_000_000 - 3600 * 5, now), "5h ago");
  assert.equal(timeAgo(1_700_000_000 - 86400 * 3, now), "3d ago");
  assert.equal(timeAgo(1_700_000_000 - 86400 * 14, now), "2w ago");
});

test("deriveOverview aggregates wins, damage and accuracy", () => {
  const matches = [
    match({ matchid: "a", won: true }),
    match({ matchid: "b", won: false }),
  ];
  const s = deriveOverview(matches, ME);
  assert.equal(s.wins, 1);
  assert.equal(s.losses, 1);
  assert.equal(s.winRate, 50);
  assert.equal(s.kills, 40);
  assert.equal(s.deaths, 30);
  assert.equal(s.assists, 8);
  // 20 headshots out of 60 shots per match.
  assert.equal(Number(s.hs.toFixed(1)), 33.3);
  // 4000 damage over 24 rounds.
  assert.equal(Number(s.adr.toFixed(1)), 166.7);
  // 4800 score over 24 rounds.
  assert.equal(s.acs, 200);
  assert.equal(Number(s.kad.toFixed(2)), 1.6);
  assert.equal(Number(s.ddPerRound.toFixed(0)), 42);
});

test("deriveOverview ignores empty samples safely", () => {
  const s = deriveOverview([], ME);
  assert.equal(s.matches, 0);
  assert.equal(s.winRate, 0);
  assert.equal(s.kd, 0);
  assert.equal(s.adr, 0);
});

test("deriveAccuracy counts head, body and legs", () => {
  const a = deriveAccuracy([match({ matchid: "a" })], ME);
  assert.equal(Number(a.head.pct.toFixed(1)), 33.3);
  assert.equal(a.head.hits, 20);
  assert.equal(a.body.hits, 30);
  assert.equal(a.legs.hits, 10);
});

test("deriveMatchRows exposes result, score, placement and K/D", () => {
  const rows = deriveMatchRows([
    match({ matchid: "a", won: true, kills: 20, deaths: 10 }),
    match({ matchid: "b", won: false, map: "Lotus", kills: 10, deaths: 20 }),
  ], ME);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].result, "win");
  assert.equal(rows[0].won, 13);
  assert.equal(rows[0].lost, 9);
  assert.equal(rows[0].kd, 2);
  assert.equal(rows[0].place, "1st");
  assert.equal(rows[1].result, "loss");
  assert.equal(rows[1].map, "Lotus");
});

test("deriveRoles groups agents by role", () => {
  const roles = deriveRoles([
    match({ matchid: "a", character: "Jett" }),
    match({ matchid: "b", character: "Cypher" }),
    match({ matchid: "c", character: "Omen" }),
    match({ matchid: "d", character: "Unknown Agent" }),
  ], ME);
  const keys = roles.map((r) => r.role).sort();
  assert.deepEqual(keys, ["controller", "duelist", "sentinel"]);
  assert.equal(roles.find((r) => r.role === "duelist")?.matches, 1);
});

test("deriveMaps sorts by games played then win rate", () => {
  const maps = deriveMaps([
    match({ matchid: "a", map: "Sunset", won: true }),
    match({ matchid: "b", map: "Sunset", won: true }),
    match({ matchid: "c", map: "Lotus", won: false }),
  ], ME);
  assert.equal(maps[0].map, "Sunset");
  assert.equal(maps[0].games, 2);
  assert.equal(maps[0].winRate, 100);
  assert.equal(maps[1].winRate, 0);
});

test("groupByDay groups consecutive matches on the same day", () => {
  const rows = deriveMatchRows([
    match({ matchid: "a", game_start: 1_700_000_000 }),
    match({ matchid: "b", game_start: 1_700_000_500 }),
    match({ matchid: "c", game_start: 1_690_000_000 }),
  ], ME);
  const groups = groupByDay(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].rows.length, 2);
});

test("playtimeLabel sums match duration", () => {
  const label = playtimeLabel([
    match({ matchid: "a", game_length: 1800 }),
    match({ matchid: "b", game_length: 1800 }),
  ]);
  assert.equal(label, "1h Playtime");
});
