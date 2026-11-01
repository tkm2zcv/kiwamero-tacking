import test from "node:test";
import assert from "node:assert/strict";
import { isPuuid, parsePlayerSearch, playerProfilePath } from "../src/lib/player-search.ts";

const id = "4172c23f-8c2e-5c68-9afb-2ea38c5e2028";

test("PUUID searches accept the supplied UUID and normalize case/outer whitespace", () => {
  assert.equal(isPuuid(id), true);
  const player = parsePlayerSearch(` \n${id.toUpperCase()} \t`);
  assert.deepEqual(player, { kind: "puuid", puuid: id });
  assert.equal(playerProfilePath(player!), `/valorant/profile/riot/${id}`);
});

test("Riot ID searches preserve Japanese characters, spaces, percent signs and tags", () => {
  for (const [name, tag] of [["佐々木 拓磨", "ゴラッソ"], ["50% Player", "JP1"], [id, "TAG"]]) {
    const player = parsePlayerSearch(` ${name}#${tag} `);
    assert.deepEqual(player, { kind: "riot", name, tag });
    assert.equal(playerProfilePath(player!), `/valorant/profile/riot/${encodeURIComponent(`${name}#${tag}`)}`);
  }
});

test("malformed or incomplete identifiers are rejected before navigation", () => {
  for (const value of ["", "name", "name#", "#tag", id.slice(1), `${id}/overview`,
    id.replace("4172", "zzzz"), id.replaceAll("-", ""), `https://example.com/${id}`]) {
    assert.equal(parsePlayerSearch(value), null, value);
  }
});
