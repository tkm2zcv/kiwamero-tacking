import test from "node:test";
import assert from "node:assert/strict";
import { normalizeV4Page } from "../src/lib/henrik-v4.ts";
import { archivePayload } from "../src/lib/match-archive-payload.ts";
import { normalizeHDMatch } from "../src/lib/match-normalize.ts";
import { selfId, matchId } from "./history-fixtures.ts";
import { v4Match } from "./roster-fixtures.ts";

test("v4 ended rosters map into the existing validated immutable archive", () => {
  const page = normalizeV4Page([v4Match(1)], selfId);
  assert.equal(page.received, 1);
  assert.equal(page.matches.length, 1);
  const m = normalizeHDMatch(JSON.parse(archivePayload(page.matches[0])));
  assert.equal(m.metadata.matchid, matchId(1));
  assert.equal(m.metadata.rounds_played, 24);
  assert.equal(m.metadata.mode_id, "competitive");
  assert.equal(m.players.length, 10);
  assert.equal(m.players[0].puuid, selfId);
  assert.equal(m.players[0].party_id, "red-party");
  assert.equal(m.players[0].currenttier, 12);
  assert.equal(m.teams.red.rounds_won, 13);
});

test("unavailable, unfinished, wrong-owner and partial rows retain page positions without fabricated rosters", () => {
  const unfinished = v4Match(2); unfinished.metadata.is_completed = false;
  const partial = v4Match(3); partial.players.pop();
  const wrong = v4Match(4); wrong.players[0].puuid = "other";
  const duplicate = v4Match(1);
  const page = normalizeV4Page([v4Match(1), null, unfinished, partial, wrong, duplicate], selfId);
  assert.equal(page.received, 6);
  assert.deepEqual(page.matches.map((m) => m.metadata.matchid), [matchId(1)]);
  assert.equal(page.unavailable, 4);
});

test("v4 missing stats cannot silently become zeroes and duplicate pages have stable fingerprints", () => {
  const invalid = v4Match(1);
  const stats = invalid.players[0].stats as Partial<typeof invalid.players[0]["stats"]>;
  delete stats.kills;
  assert.equal(normalizeV4Page([invalid], selfId).matches.length, 0);
  assert.equal(normalizeV4Page([v4Match(2)], selfId).fingerprint,
    normalizeV4Page([v4Match(2)], selfId).fingerprint);
  assert.notEqual(normalizeV4Page([v4Match(2)], selfId).fingerprint,
    normalizeV4Page([v4Match(3)], selfId).fingerprint);
  assert.throws(() => normalizeV4Page({}, selfId));
});
