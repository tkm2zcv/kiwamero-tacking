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
const resourceNames = { getMmr: "rating", getMatches: "recent", getMmrHistory: "history", getStoredMatches: "stored" };

for (const key of resources) {
  for (const [status, reason] of [[403, "private"], [429, "rate_limited"], [503, "upstream"]] as const) {
    test(`${key} ${status} remains unavailable rather than becoming zero statistics`, async () => {
      const result = await loadProfileSource({
        ...sources, [key]: async () => { throw new HenrikDevError(status, "upstream failure"); },
      }, "Player", "TAG");
      assert.equal(result.ok, true);
      if (result.ok) assert.deepEqual(result.issues, [{ resource: resourceNames[key], reason }]);
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
  assert.equal(result.ok, true);
  if (result.ok) assert.deepEqual(result.issues, [{ resource: "recent", reason: "upstream" }]);
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
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.issues, [{ resource: resourceNames[resource], reason: "upstream" }]);
  });
}

test("a stalled identity returns a timeout instead of an endless loading state", async () => {
  const started = Date.now();
  const result = await loadProfileSource({
    ...sources, getAccount: () => new Promise(() => {}),
  }, "Player", "TAG", { deadline: started + 30 });
  assert.deepEqual(result, { ok: false, reason: "timeout" });
  assert.ok(Date.now() - started < 500);
});

test("the absolute deadline includes identity and all four parallel reads", async () => {
  const started = Date.now();
  const slow = () => new Promise<never>(() => {});
  const result = await loadProfileSource({
    ...sources,
    getAccount: async () => { await new Promise((resolve) => setTimeout(resolve, 40)); return account; },
    getMmr: slow, getMatches: slow, getMmrHistory: slow, getStoredMatches: slow,
  }, "Player", "TAG", { deadline: started + 80 });
  assert.ok(Date.now() - started < 300, "must not start a separate timeout for each stage/resource");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.account.puuid, "p1");
    assert.deepEqual(new Set(result.issues.map((issue) => issue.resource)), new Set(["rating", "recent", "history", "stored"]));
    assert.ok(result.issues.every((issue) => issue.reason === "timeout"));
  }
});

test("slow optional reads retain real fast data and finish once in the background", async () => {
  let finish!: (value: []) => void;
  let calls = 0;
  let completion!: Promise<Awaited<ReturnType<typeof loadProfileSource>>>;
  const result = await loadProfileSource({
    ...sources,
    getMmr: async () => ({ current_data: { currenttier: 20 } } as never),
    getMatches: () => { calls++; return new Promise((resolve) => { finish = resolve; }); },
  }, "Player", "TAG", { deadline: Date.now() + 30, background: (task) => { completion = task; } });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.mmr?.current_data?.currenttier, 20);
    assert.deepEqual(result.issues, [{ resource: "recent", reason: "timeout" }]);
  }
  finish([]);
  const completed = await completion;
  assert.equal(completed.ok, true);
  if (completed.ok) assert.deepEqual(completed.issues, []);
  assert.equal(calls, 1, "no retry fanout after the foreground deadline");
});
