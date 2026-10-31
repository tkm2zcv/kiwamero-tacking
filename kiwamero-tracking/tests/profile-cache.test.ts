import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import {
  deleteProfileSnapshot, profileCacheKey, readProfileSnapshot, refreshProfileSnapshot,
  resetProfileCache, writeProfileSnapshot, type ProfileSnapshot,
} from "../src/lib/profile-cache.ts";

const seed = JSON.parse(fs.readFileSync("src/data/profile.json", "utf8"));
const snapshot = (age = 0): ProfileSnapshot => ({
  bundle: { ...seed, profile: { ...seed.profile }, matches: [], source: "henrikdev", capturedAt: new Date(Date.now() - age).toISOString() },
  storedMatches: [],
});
function edgeStore() {
  const store = new Map<string, string>();
  (globalThis as { caches?: unknown }).caches = { default: {
    match: async (req: Request) => store.has(req.url) ? new Response(store.get(req.url)) : undefined,
    put: async (req: Request, res: Response) => {
      assert.match(res.headers.get("cache-control")!, /max-age=86400/);
      store.set(req.url, await res.text());
    },
    delete: async (req: Request) => store.delete(req.url),
  } };
  return store;
}
test.afterEach(() => {
  resetProfileCache();
  delete (globalThis as { caches?: unknown }).caches;
});

test("profile keys isolate identity, mode, and included sources but share acts/pages", () => {
  const base = profileCacheKey("Player", "TAG", { mode: "competitive" });
  assert.equal(base, profileCacheKey("PLAYER", "tag", { mode: "competitive" }));
  assert.notEqual(base, profileCacheKey("Other", "TAG", { mode: "competitive" }));
  assert.notEqual(base, profileCacheKey("Player", "TAG", { mode: "unrated" }));
  assert.notEqual(base, profileCacheKey("Player", "TAG", { mode: "competitive", includeRecentMatches: false }));
});

test("a saved profile survives a cold isolate and retains the real capture time", async () => {
  edgeStore();
  const data = snapshot(20 * 60_000);
  await writeProfileSnapshot("player", data);
  resetProfileCache();
  assert.deepEqual(await readProfileSnapshot("player", Date.now() + 1000), data);
  await deleteProfileSnapshot("player");
  resetProfileCache();
  assert.equal(await readProfileSnapshot("player", Date.now() + 1000), null);
});

test("expired, malformed, and seed snapshots never become live data", async () => {
  const store = edgeStore();
  await writeProfileSnapshot("expired", snapshot(25 * 3600_000));
  assert.equal(await readProfileSnapshot("expired", Date.now() + 1000), null);
  await writeProfileSnapshot("bad-source", { ...snapshot(), bundle: { ...snapshot().bundle, source: "seed" } });
  assert.equal(await readProfileSnapshot("bad-source", Date.now() + 1000), null);
  store.set("https://profile-cache.internal/v1/corrupt", "{");
  assert.equal(await readProfileSnapshot("corrupt", Date.now() + 1000), null);
});

test("a stalled edge cache cannot consume the profile deadline", async () => {
  (globalThis as { caches?: unknown }).caches = { default: { match: () => new Promise(() => {}) } };
  const started = Date.now();
  assert.equal(await readProfileSnapshot("absent", started + 30), null);
  assert.ok(Date.now() - started < 500);
});

test("cached profiles are detached and memory entries have a fixed cap", async () => {
  const data = snapshot();
  await writeProfileSnapshot("first", data);
  data.bundle.profile.name = "mutated";
  assert.notEqual((await readProfileSnapshot("first", Date.now() + 1000))?.bundle.profile.name, "mutated");
  for (let i = 0; i < 16; i++) await writeProfileSnapshot(`key-${i}`, snapshot());
  assert.equal(await readProfileSnapshot("first", Date.now() + 1000), null);
});

test("oversized profiles are not retained in memory or edge cache", async () => {
  const store = edgeStore();
  await writeProfileSnapshot("large", snapshot());
  const data = snapshot();
  data.bundle.profile.name = "x".repeat(1_800_001);
  await writeProfileSnapshot("large", data);
  assert.equal(store.size, 0);
  assert.equal(await readProfileSnapshot("large", Date.now() + 1000), null);
});

test("SWR refresh is deferred, coalesced, and released after failure", async () => {
  const tasks: (() => Promise<void>)[] = [];
  let calls = 0;
  const defer = (task: () => Promise<void>) => { tasks.push(task); };
  const work = async () => { calls++; };
  refreshProfileSnapshot("player", defer, work);
  refreshProfileSnapshot("player", defer, work);
  assert.equal(calls, 0);
  assert.equal(tasks.length, 1);
  await tasks.shift()!();
  refreshProfileSnapshot("player", defer, async () => { throw new Error("refresh failure"); });
  await assert.rejects(tasks.shift()!());
  refreshProfileSnapshot("player", defer, work);
  await tasks.shift()!();
  assert.equal(calls, 2);
});
