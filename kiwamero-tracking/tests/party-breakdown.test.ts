import test from "node:test";
import assert from "node:assert/strict";
import { buildPartyBreakdown } from "../src/lib/stored-stats.ts";
import type { Match, MatchPlayer } from "../src/lib/types.ts";

function player(puuid: string, team: string, party: string | undefined, kills: number, deaths: number, score = 100): MatchPlayer {
  return {
    puuid, name: puuid, tag: "T", team_id: team, character: "Jett", party_id: party,
    stats: { kills, deaths, score, assists: 0, headshots: 0, bodyshots: 0, legshots: 0 },
  } as MatchPlayer;
}

function match(id: string, players: MatchPlayer[], redWon = true): Match {
  return {
    metadata: { matchid: id, mode_id: "competitive", game_start: 100 },
    teams: { red: { has_won: redWon }, blue: { has_won: !redWon } },
    players,
  } as unknown as Match;
}

function roster(selfParty: string | undefined, selfTeamSize: number, selfScore = 100): MatchPlayer[] {
  // party "self-p" holds self + (selfTeamSize-1) premade teammates; rest solo
  return [
    player("self", "red", selfParty, 10, 5, selfScore),
    ...Array.from({ length: selfTeamSize - 1 }, (_, i) =>
      player(`mate${i}`, "red", selfParty, 3, 8, 50)),
    ...Array.from({ length: 5 - selfTeamSize }, (_, i) =>
      player(`rand${i}`, "red", `r${i}`, 3, 8, 60)),
    ...Array.from({ length: 5 }, (_, i) => player(`en${i}`, "blue", `e${i}`, 8, 3, 200)),
  ];
}

test("Party breakdown buckets by shared party_id, self stats only", () => {
  const matches = [
    match("solo1", roster("s1", 1, 300)),
    match("solo2", roster("s2", 1, 300), false),
    match("duo", roster("d1", 2, 50)),
    match("trio", roster("t1", 3)),
    match("five", roster("f1", 5)),
  ];
  const by = new Map(buildPartyBreakdown(matches, "self").map((b) => [b.size, b]));
  assert.equal(by.size, 4);
  const solo = by.get(1)!;
  assert.equal(solo.matches, 2);
  assert.equal(solo.wins, 1);
  assert.equal(solo.winRate, 50);
  assert.equal(solo.kd, 2);
  // score 300 vs enemies' 200/60/50 → self places 1st both solo games
  assert.equal(solo.avgPlace, 1);
  assert.equal(by.get(2)!.matches, 1);
  assert.equal(by.get(3)!.matches, 1);
  assert.equal(by.get(5)!.matches, 1);
  // duo game: self score 50 → places below mates/enemies
  assert.ok(by.get(2)!.avgPlace > 1);
});

test("Missing party_id or self is skipped, never counted as solo", () => {
  const matches = [
    match("no-party", roster(undefined, 5)),
    match("no-self", [player("other", "red", "x", 1, 1)]),
  ];
  assert.equal(buildPartyBreakdown(matches, "self").length, 0);
});

test("Cross-team party_id coincidence does not inflate size", () => {
  const m = match("weird", [
    player("self", "red", "shared", 1, 1),
    player("mate", "red", "shared", 1, 1, 90),
    player("enemy", "blue", "shared", 1, 1, 80),
  ]);
  assert.equal(buildPartyBreakdown([m], "self")[0].size, 2);
});
