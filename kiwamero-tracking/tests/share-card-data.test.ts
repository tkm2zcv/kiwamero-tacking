import test from "node:test";
import assert from "node:assert/strict";
import { buildShareCardModel } from "../src/lib/share-card-data.ts";
import type { StoredRow } from "../src/lib/stored-stats.ts";
import type { Profile } from "../src/lib/types.ts";

const profile: Profile = {
  name: "Player",
  tag: "TAG",
  puuid: "puuid",
  level: 928,
  region: "ap",
  currentRank: "Radiant",
  currentTier: 27,
  rr: 813,
  peakRank: "Radiant",
  actCode: "e11a6",
};

function row(overrides: Partial<StoredRow>): StoredRow {
  return {
    id: "match",
    map: "Ascent",
    mapId: "ascent",
    mode: "competitive",
    startedAt: 1,
    day: "Jan 1",
    seasonId: "uuid-old",
    seasonShort: "e11a5",
    agent: "Jett",
    agentId: "jett",
    tier: 20,
    score: 200,
    kills: 10,
    deaths: 10,
    assists: 2,
    head: 5,
    body: 10,
    leg: 0,
    dmgMade: 2000,
    dmgRecv: 1800,
    won: 13,
    lost: 10,
    rounds: 23,
    result: "win",
    cluster: "Tokyo 1",
    selfName: "Player",
    selfTag: "TAG",
    level: 900,
    ...overrides,
  };
}

function build(rows: StoredRow[], playlist = "competitive") {
  return buildShareCardModel({
    profile,
    rows,
    playlist,
    actCode: profile.actCode,
    actLabel: "V26: A6",
    cardArtUrl: "https://media.valorant-api.com/playercards/card/smallart.png",
    rankIconUrl: "https://media.valorant-api.com/rank.png",
  });
}

test("share card stats use the current act, not an older selected act or lifetime rows", () => {
  const card = build([
    row({ id: "old", seasonId: "uuid-old", seasonShort: "e11a5", kills: 1, deaths: 1 }),
    row({ id: "current", seasonId: "uuid-current", seasonShort: "e11a6", kills: 30, deaths: 10, startedAt: 2 }),
  ]);

  assert.equal(card.actLabel, "V26: A6");
  assert.equal(card.stats.matches, 1);
  assert.equal(card.stats.kills, 30);
  assert.equal(card.stats.deaths, 10);
  assert.equal(card.matchesAvailable, 1);
});

test("share card keeps the selected playlist and uses the dominant current-act server", () => {
  const card = build([
    row({ id: "a", seasonId: "uuid-current", seasonShort: "e11a6", cluster: "Tokyo 1", startedAt: 2 }),
    row({ id: "b", seasonId: "uuid-current", seasonShort: "e11a6", cluster: "Tokyo 2", startedAt: 3 }),
    row({ id: "c", seasonId: "uuid-current", seasonShort: "e11a6", cluster: "Seoul", mode: "unrated", startedAt: 4 }),
  ], "unrated");

  assert.equal(card.playlistLabel, "Unrated");
  assert.equal(card.server, "Seoul");
  assert.equal(card.stats.matches, 1);
  assert.equal(card.avatarUrl, "/agents/jett.webp");
});

test("share card reports an empty current-act scope without inventing stats", () => {
  const card = build([
    row({ id: "old", seasonId: "uuid-old", seasonShort: "e11a5", cluster: "Frankfurt" }),
  ]);

  assert.equal(card.matchesAvailable, 0); // does not pass an older act off as the current act
  assert.equal(card.server, "Frankfurt"); // server falls back to the available act rows
  assert.equal(card.stats.matches, 0);

  const empty = buildShareCardModel({
    profile,
    rows: [],
    playlist: "competitive",
    actCode: profile.actCode,
    actLabel: "V26: A6",
    rankIconUrl: "",
  });
  assert.equal(empty.matchesAvailable, 0);
  assert.equal(empty.stats.matches, 0);
  assert.equal(empty.server, "AP");
  assert.equal(empty.avatarUrl, undefined);
});
