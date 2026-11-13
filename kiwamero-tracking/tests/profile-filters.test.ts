import test from "node:test";
import assert from "node:assert/strict";
import { canonicalMatchMode, createActFilter, filterProfileMatches, playlistModeLabel, playlistUpstreamMode, profileFilterHref, recentEncounterIds } from "../src/lib/profile-filters.ts";
import { matchId } from "./history-fixtures.ts";
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

test("HenrikDev mode ids and stored display names canonicalize to the same playlist", () => {
  // v3/v4 mode_id values observed in the match archive.
  assert.equal(canonicalMatchMode("hurm"), "teamdeathmatch");
  assert.equal(canonicalMatchMode("skirmish_2v2"), "teamdeathmatch");
  assert.equal(canonicalMatchMode("abilitydraftarena"), "gauntlet");
  assert.equal(canonicalMatchMode(""), "");
  // stored-matches display names.
  assert.equal(canonicalMatchMode("Team Deathmatch"), "teamdeathmatch");
  assert.equal(canonicalMatchMode("Custom Game"), "custom");
  assert.equal(canonicalMatchMode("Gauntlet: Glitched"), "gauntlet");
  assert.equal(canonicalMatchMode("Spike Rush"), "spikerush");
  assert.equal(canonicalMatchMode("Snowball Fight"), "snowball");
  // Unmapped names keep their normalized form (only reachable via "all").
  assert.equal(canonicalMatchMode("All Random One Site"), "allrandomonesite");
  assert.equal(canonicalMatchMode(null), "");
  assert.equal(playlistModeLabel("teamdeathmatch"), "Team Deathmatch");
  assert.equal(playlistModeLabel("gauntlet"), "Gauntlet");
});

test("playlist filters match v3 mode_id and stored display names across mode families", () => {
  const inAll = createActFilter("all", ids, shorts, "");
  const tdm = { ...roster("tdm", "uuid-current", "Opponent"), metadata: { matchid: "tdm", season_id: "uuid-current", mode_id: "hurm", mode: "", game_start: 100 } } as Match;
  const skirmish = { ...roster("sk", "uuid-current", "Opponent"), metadata: { matchid: "sk", season_id: "uuid-current", mode_id: "skirmish_2v2", mode: "", game_start: 100 } } as Match;
  const custom = { ...roster("cu", "uuid-current", "Opponent"), metadata: { matchid: "cu", season_id: "uuid-current", mode_id: "", mode: "Custom Game", game_start: 100 } } as Match;
  const gauntlet = { ...roster("ga", "uuid-current", "Opponent"), metadata: { matchid: "ga", season_id: "uuid-current", mode_id: "abilitydraftarena", mode: "", game_start: 100 } } as Match;
  const ffa = { ...roster("dm", "uuid-current", "Opponent"), metadata: { matchid: "dm", season_id: "uuid-current", mode_id: "deathmatch", mode: "", game_start: 100 } } as Match;
  const pool = [...matches, tdm, skirmish, custom, gauntlet, ffa];
  assert.deepEqual(filterProfileMatches(pool, "teamdeathmatch", inAll, shorts).map((m) => m.metadata.matchid), ["tdm", "sk"]);
  assert.deepEqual(filterProfileMatches(pool, "custom", inAll, shorts).map((m) => m.metadata.matchid), ["cu"]);
  assert.deepEqual(filterProfileMatches(pool, "gauntlet", inAll, shorts).map((m) => m.metadata.matchid), ["ga"]);
  assert.deepEqual(filterProfileMatches(pool, "deathmatch", inAll, shorts).map((m) => m.metadata.matchid), ["dm"],
    "FFA deathmatch must not absorb team deathmatch or skirmish");
  assert.equal(filterProfileMatches(pool, "all", inAll, shorts).length, pool.length);
});

test("only core high-volume playlists narrow the upstream mode fetch", () => {
  for (const slug of ["competitive", "premier", "unrated", "deathmatch", "swiftplay"]) {
    assert.equal(playlistUpstreamMode(slug), slug);
  }
  for (const slug of ["teamdeathmatch", "custom", "gauntlet", "spikerush", "all"]) {
    assert.equal(playlistUpstreamMode(slug), undefined, slug);
  }
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

test("all acts remain included and encounters deduplicate PUUIDs and match IDs across renames", () => {
  const first = roster("old", "uuid-old", "Other");
  first.players[0].name = "PreviousName";
  const latest = roster("latest", "uuid-current", "Other");
  latest.metadata.game_start = 200;
  latest.players[1].name = "Renamed";
  const entries = buildEncounters([latest, first, first], "Player", "TAG", "self");
  assert.equal(entries.length, 1);
  assert.equal(entries[0].name, "Renamed");
  assert.equal(entries[0].playedAgainst, 2);
  assert.equal(entries[0].encounters, 2);
  assert.deepEqual(entries, buildEncounters([first, latest], "Player", "TAG", "self"));
  assert.deepEqual(buildEncounters([first], "Player", "TAG", "not-in-roster"), []);
});

test("recent encounter acquisition is the full stored history, deduped and newest-first", () => {
  const rows = Array.from({ length: 703 }, (_, i) => ({
    id: matchId(i + 1), startedAt: i, mode: i % 2 ? "competitive" : "unrated",
  }));
  const input = [rows[702], ...rows, rows[702]];
  const before = [...input];
  const ids = recentEncounterIds(input);
  assert.equal(ids.length, 702); // startedAt 0 is rejected as invalid
  assert.equal(ids[0], matchId(703));
  assert.equal(ids.at(-1), matchId(2));
  assert.deepEqual(input, before);
  assert.deepEqual(recentEncounterIds([]), []);
});

test("ALL playlists keep the encounter tab, selected Act and opponent filter", () => {
  const href = profileFilterHref("/profile/Player", "encounters", "all", "e11a5", "against");
  const url = new URL(href, "https://example.test");
  assert.equal(url.pathname, "/profile/Player/encounters");
  assert.equal(url.searchParams.get("playlist"), "all");
  assert.equal(url.searchParams.get("season"), "e11a5");
  assert.equal(url.searchParams.get("played"), "against");
  const all = filterProfileMatches(matches, "all", createActFilter("all", ids, shorts, ""), shorts);
  assert.equal(all.length, 3);
  assert.equal(buildEncounters(all, "Player", "TAG").length, 3);
});
