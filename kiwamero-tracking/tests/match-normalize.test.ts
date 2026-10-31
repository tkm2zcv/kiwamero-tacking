import test from "node:test";
import assert from "node:assert/strict";
import { hdMatchPlayers, normalizeHDMatch, normalizeHDMatches } from "../src/lib/match-normalize.ts";
import { HenrikDevError } from "../src/lib/henrik-errors.ts";
import type { HDMatch } from "../src/lib/henrik-model.ts";
import { tierName } from "../src/lib/henrik-shared.ts";

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

test("null-metadata history placeholders cannot crash valid matches or become zero-stat matches", () => {
  const valid = hd();
  const invalid = [null, hd({ metadata: null }), hd({ metadata: { ...valid.metadata, map: null } }),
    hd({ players: null }), hd({ players: { all_players: null } }), hd({ players: [null] }),
    hd({ players: [{ ...hdMatchPlayers(valid)[0], stats: null }] }), hd({ teams: null })];
  const before = structuredClone(valid);
  const result = normalizeHDMatches([...invalid, valid]);
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].metadata.matchid, valid.metadata.matchid);
  assert.equal(result.matches[0].players[0].stats.kills, 20);
  assert.equal(result.unavailable, invalid.length);
  assert.deepEqual(valid, before);
  assert.deepEqual(normalizeHDMatches(invalid), { matches: [], unavailable: invalid.length });
});

test("single incomplete matches fail with a typed provider error, not a null dereference", () => {
  for (const raw of [null, hd({ metadata: null }), hd({ metadata: { matchid: "m1", map: null } })]) {
    assert.throws(() => normalizeHDMatch(raw as HDMatch), e => e instanceof HenrikDevError && e.status === 502);
  }
  assert.throws(() => normalizeHDMatches({}), e => e instanceof HenrikDevError && e.status === 502);
  assert.deepEqual(normalizeHDMatches([]), { matches: [], unavailable: 0 });
});

test("FFA matches may have null teams, but unavailable competitive scores and player stats are not fabricated", () => {
  const valid = hd(), person = hdMatchPlayers(valid)[0];
  const ffaMeta = { ...valid.metadata, mode: "Deathmatch", mode_id: "deathmatch" };
  for (const teams of [null, [], {}]) {
    const ffa = hd({
      metadata: ffaMeta, teams,
      players: [{ ...person, team: undefined, team_id: undefined }],
    });
    assert.equal(normalizeHDMatches([ffa]).matches.length, 1, `teams=${JSON.stringify(teams)}`);
  }
  for (const missing of [null, undefined, "12", Number.NaN, -1]) {
    const raw = hd({ players: [{ ...person, stats: { ...person.stats, kills: missing } }] });
    assert.deepEqual(normalizeHDMatches([raw]), { matches: [], unavailable: 1 });
  }
  assert.deepEqual(hdMatchPlayers(null), []);
  assert.deepEqual(hdMatchPlayers(hd({ players: { all_players: {} } })), []);
});

test("hollow team records cannot fabricate a draw in any team-based mode", () => {
  for (const [mode, mode_id] of [["Competitive", "competitive"], ["Unrated", "unrated"]]) {
    for (const teams of [{}, { red: {}, blue: {} }, null]) {
      const raw = hd({
        metadata: { ...hd().metadata, mode, mode_id },
        teams: teams === null ? null : teams,
      });
      // `teams: null` in a team mode is also rejected — wins would be invented.
      assert.deepEqual(normalizeHDMatches([raw]), { matches: [], unavailable: 1 },
        `${mode} teams=${JSON.stringify(teams)}`);
    }
  }
});

test("one malformed player marks the whole match unavailable rather than a partial roster", () => {
  const valid = hd(), person = hdMatchPlayers(valid)[0];
  const roster = Array.from({ length: 10 }, () => ({ ...person }));
  const broken = { ...person, name: null };
  const raw = hd({ players: [...roster, broken] });
  assert.deepEqual(normalizeHDMatches([raw]), { matches: [], unavailable: 1 });
});

test("archived payloads are skipped per-match when older writes fail the stricter guard", () => {
  const good = hd();
  const staleWrite = hd({ players: [{ ...hdMatchPlayers(good)[0], tag: null }] });
  const payloads = [good, staleWrite].map((m) => {
    try { return JSON.parse(JSON.stringify(m)); } catch { return null; }
  });
  const result = normalizeHDMatches(payloads);
  assert.equal(result.matches.length, 1);
  assert.equal(result.unavailable, 1);
});
