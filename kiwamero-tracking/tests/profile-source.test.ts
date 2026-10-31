import test from "node:test";
import assert from "node:assert/strict";
import { HenrikDevError } from "../src/lib/henrik-client.ts";
import { loadProfileSource, type ProfileSources } from "../src/lib/profile-source.ts";
import type { HDAccount } from "../src/lib/henrik-model.ts";

const account: HDAccount = {
  puuid: "p1", region: "ap", account_level: 10, name: "Player", tag: "TAG",
  card: { small: "", large: "", wide: "", id: "" }, last_update: "",
};
const sources: ProfileSources = {
  getAccount: async () => account,
  getMmr: async () => ({}),
  getMatches: async () => [],
  getMmrHistory: async () => [],
  getStoredMatches: async () => [],
};
const resources = ["getMmr", "getMatches", "getMmrHistory", "getStoredMatches"] as const;

for (const key of resources) {
  for (const [status, reason] of [[403, "private"], [429, "rate_limited"], [503, "upstream"]] as const) {
    test(`${key} ${status} remains unavailable rather than becoming zero statistics`, async () => {
      const result = await loadProfileSource({
        ...sources, [key]: async () => { throw new HenrikDevError(status, "upstream failure"); },
      }, "Player", "TAG");
      assert.deepEqual(result, { ok: false, reason });
    });
  }
  test(`${key} 404 permits a real account with no history`, async () => {
    const result = await loadProfileSource({
      ...sources, [key]: async () => { throw new HenrikDevError(404, "no history"); },
    }, "Player", "TAG");
    assert.equal(result.ok, true);
  });
}

test("account 404 is a missing identity, not an empty successful profile", async () => {
  const result = await loadProfileSource({
    ...sources, getAccount: async () => { throw new HenrikDevError(404, "missing"); },
  }, "Nobody", "TAG");
  assert.deepEqual(result, { ok: false, reason: "not_found" });
});

test("transport failures are unavailable", async () => {
  const result = await loadProfileSource({
    ...sources, getMatches: async () => { throw new TypeError("fetch failed"); },
  }, "Player", "TAG");
  assert.deepEqual(result, { ok: false, reason: "upstream" });
});

test("recent and stored history share the requested player and playlist", async () => {
  const calls: unknown[] = [];
  const result = await loadProfileSource({
    ...sources,
    getMatches: async (...args) => { calls.push(args); return []; },
    getStoredMatches: async (...args) => { calls.push(args); return []; },
  }, "Player", "TAG", { mode: "unrated" });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, [
    ["ap", "p1", { size: 25, mode: "unrated" }],
    ["ap", "p1", { mode: "unrated" }],
  ]);
});

test("tabs can skip recent rosters and stored history independently", async () => {
  const calls: string[] = [];
  const result = await loadProfileSource({
    ...sources,
    getMatches: async () => { calls.push("recent"); return []; },
    getStoredMatches: async () => { calls.push("stored"); return []; },
  }, "Player", "TAG", { includeRecentMatches: false, includeStoredMatches: false });
  assert.equal(result.ok, true);
  assert.deepEqual(calls, []);
  if (result.ok) {
    assert.equal(result.data.hdMatches.length, 0);
    assert.equal(result.data.storedMatches.length, 0);
  }
});

for (const resource of ["getMatches", "getMmrHistory", "getStoredMatches"] as const) {
  test(`${resource} with an invalid list container is a labelled upstream failure, not a render exception`, async () => {
    const result = await loadProfileSource({
      ...sources, [resource]: async () => null as never,
    }, "Player", "TAG");
    assert.deepEqual(result, { ok: false, reason: "upstream" });
  });
}
