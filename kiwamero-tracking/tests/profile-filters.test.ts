import test from "node:test";
import assert from "node:assert/strict";
import { createActFilter, filterProfileMatches, profileFilterHref } from "../src/lib/profile-filters.ts";
import { buildEncounters, aggregate, storedRowToMatch, type StoredRow } from "../src/lib/stored-stats.ts";
import { deriveMatchRows } from "../src/lib/profile-stats.ts";
import type { Match } from "../src/lib/types.ts";

const ids = new Map([["e11a5", "uuid-old"], ["e11a6", "uuid-current"]]);
const shorts = new Map([["uuid-old", "e11a5"], ["uuid-current", "e11a6"]]);

function roster(id: string, season: string, opponent: string, mode = "competitive"): Match {
  return {
    metadata: { matchid: id, season_id: season, mode_id: mode, game_start: 100 },
    teams: { red: { has_won: true }, blue: { has_won: false } },
    players: [
      { puuid: "self", name: "Player", tag: "TAG", team_id: "red", character: "Jett", stats: {} },
      { puuid: opponent, name: opponent, tag: "TAG", team_id: "blue", stats: { kills: 10, deaths: 10 } },
    ],
  } as unknown as Match;
}
const matches = [
  roster("old", "uuid-old", "OldOpponent"),
  roster("current", "uuid-current", "CurrentOpponent"),
  roster("unrated", "uuid-current", "UnratedOpponent", "unrated"),
];

test("Encounters uses the selected UUID/short act and playlist, not every recent roster", () => {
  for (const act of ["uuid-current", "e11a6", "latest"]) {
    const shown = filterProfileMatches(matches, "competitive", createActFilter(act, ids, shorts, "uuid-current"), shorts);
    assert.deepEqual(shown.map((m) => m.metadata.matchid), ["current"]);
    assert.deepEqual(buildEncounters(shown, "Player", "TAG").map((e) => e.name), ["CurrentOpponent"]);
  }
  assert.equal(filterProfileMatches(matches, "all", createActFilter("all", ids, shorts, ""), shorts).length, 3);
  assert.equal(filterProfileMatches(matches, "all", createActFilter("e1a1", ids, shorts, ""), shorts).length, 0);
});

test("Encounters counts playedWith only for premade party members", () => {
  const match = {
    metadata: { matchid: "m1", season_id: "uuid-current", mode_id: "competitive", game_start: 100 },
    teams: { red: { has_won: true }, blue: { has_won: false } },
    players: [
      { puuid: "self", name: "Player", tag: "TAG", team_id: "red", party_id: "party-a", stats: {} },
      // Premade partner: same team AND same party_id
      { puuid: "duo", name: "Duo", tag: "TAG", team_id: "red", party_id: "party-a", stats: { kills: 5, deaths: 4 } },
      // Random teammate: same team, different party
      { puuid: "random", name: "Random", tag: "TAG", team_id: "red", party_id: "party-z", stats: { kills: 3, deaths: 3 } },
      // Opponent
      { puuid: "enemy", name: "Enemy", tag: "TAG", team_id: "blue", party_id: "party-b", stats: { kills: 7, deaths: 2 } },
    ],
  } as Match;
  const byName = new Map(buildEncounters([match], "Player", "TAG").map((e) => [e.name, e]));
  assert.equal(byName.get("Duo")?.playedWith, 1);
  assert.equal(byName.get("Duo")?.playedAgainst, 0);
  assert.equal(byName.get("Duo")?.winsWith, 1);
  assert.equal(byName.get("Duo")?.kills, 5);
  assert.equal(byName.get("Random")?.playedWith, 0);
  assert.equal(byName.get("Random")?.playedAgainst, 0);
  assert.equal(byName.get("Random")?.encounters, 1);
  assert.equal(byName.get("Enemy")?.playedAgainst, 1);
  assert.equal(byName.get("Enemy")?.killsAgainst, 7);
});

test("act-scoped stored aggregate reports the selected act, not lifetime or current-act totals", () => {
  const stored = [
    { seasonId: "uuid-old", seasonShort: "e11a5", result: "win", kills: 10, deaths: 5, assists: 0, head: 5, body: 5, leg: 0, dmgMade: 1000, dmgRecv: 500, score: 200, rounds: 20 },
    { seasonId: "uuid-old", seasonShort: "e11a5", result: "loss", kills: 4, deaths: 8, assists: 0, head: 2, body: 6, leg: 0, dmgMade: 800, dmgRecv: 900, score: 160, rounds: 18 },
    { seasonId: "uuid-current", seasonShort: "e11a6", result: "win", kills: 30, deaths: 1, assists: 0, head: 20, body: 5, leg: 0, dmgMade: 3000, dmgRecv: 100, score: 900, rounds: 15 },
  ] as StoredRow[];
  const inAct = createActFilter("uuid-old", ids, shorts, "uuid-current");
  const scoped = aggregate(stored.filter((r) => inAct(r.seasonId, r.seasonShort)));
  assert.equal(scoped.matches, 2);
  assert.equal(scoped.wins, 1);
  assert.equal(scoped.losses, 1);
  assert.equal(scoped.kills, 14); // excludes the 30-kill current-act match
  assert.equal(aggregate(stored).matches, 3);
});

test("stored rows render as match-list rows for every act, self-only roster hides placement", () => {
  const stored = [
    { id: "w1", map: "Ascent", mode: "competitive", startedAt: 1000, seasonId: "uuid-old", seasonShort: "e11a5", agent: "Jett", tier: 21, score: 320, kills: 20, deaths: 10, assists: 4, head: 10, body: 8, leg: 2, dmgMade: 3000, dmgRecv: 2000, won: 13, lost: 5, rounds: 18, result: "win" },
    { id: "l1", map: "Bind", mode: "competitive", startedAt: 2000, seasonId: "uuid-old", seasonShort: "e11a5", agent: "Sova", tier: 21, score: 180, kills: 8, deaths: 15, assists: 6, head: 3, body: 9, leg: 1, dmgMade: 1500, dmgRecv: 2500, won: 7, lost: 13, rounds: 20, result: "loss" },
    { id: "d1", map: "Haven", mode: "competitive", startedAt: 3000, seasonId: "uuid-current", seasonShort: "e11a6", agent: "Omen", tier: 21, score: 200, kills: 12, deaths: 12, assists: 3, head: 5, body: 7, leg: 0, dmgMade: 2000, dmgRecv: 1900, won: 14, lost: 14, rounds: 28, result: "draw" },
  ] as StoredRow[];
  const pseudo = stored.map((r) => storedRowToMatch(r, { puuid: "self", name: "Player", tag: "TAG" }));
  const rows = deriveMatchRows(pseudo, "self");
  assert.deepEqual(rows.map((r) => r.result), ["win", "loss", "draw"]);
  assert.deepEqual(rows.map((r) => `${r.won}-${r.lost}`), ["13-5", "7-13", "14-14"]);
  assert.deepEqual(rows.map((r) => r.kills), [20, 8, 12]);
  assert.deepEqual(rows.map((r) => r.agent), ["Jett", "Sova", "Omen"]);
  assert.deepEqual(rows.map((r) => r.place), ["—", "—", "—"]); // self-only roster: no placement
  // A real v3 match with a full roster still produces a placement.
  const real = deriveMatchRows([roster("real", "uuid-old", "Opp")], "self");
  assert.notEqual(real[0].place, "—");
});

test("played and act selectors preserve each other's URL state", () => {
  const href = profileFilterHref("/profile/Player%23TAG", "encounters", "competitive", "e11a6", "against");
  const query = new URL(href, "https://example.test").searchParams;
  assert.equal(query.get("season"), "e11a6");
  assert.equal(query.get("played"), "against");
  assert.equal(query.get("playlist"), "competitive");
  const withHref = profileFilterHref("/profile/id", "encounters", "unrated", "uuid-old", "with");
  assert.equal(new URL(withHref, "https://example.test").searchParams.get("season"), "uuid-old");
  assert.equal(new URL(withHref, "https://example.test").searchParams.get("played"), null);
});
