import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { matchId, selfId } from "./history-fixtures.ts";
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
  const store = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = { default: {
    match: async (req: Request) => store.get(req.url)?.clone(),
    put: async (req: Request, res: Response) => {
      assert.match(res.headers.get("cache-control")!, /max-age=86400/);
      store.set(req.url, res.clone());
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
  store.set("https://profile-cache.internal/v2/corrupt", new Response("{"));
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
  data.bundle.profile.name = "x".repeat(8_000_001);
  await writeProfileSnapshot("large", data);
  assert.equal(store.size, 0);
  assert.equal(await readProfileSnapshot("large", Date.now() + 1000), null);
});

test("large complete histories survive compression and cold-isolate reads without losing matches", async (t) => {
  // Test the real codec independently of host CPU contention; deadline behavior has its own test.
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = edgeStore();
  const data = snapshot(120_000);
  data.storedMatches = Array.from({ length: 5000 }, (_, i) => ({
    meta: { id: matchId(i), map: { id: matchId(1), name: "Ascent" }, mode: "Competitive",
      started_at: new Date(1_790_000_000_000 + i * 3600_000).toISOString(),
      season: { id: matchId(2), short: "e11a6" }, region: "ap", cluster: "Tokyo" },
    stats: { puuid: selfId, name: "Player", tag: "TAG", team: "red", level: 100,
      character: { id: matchId(3), name: "Jett" }, tier: 12, score: 4800,
      kills: 12, deaths: 12, assists: 3, shots: { head: 8, body: 14, leg: 2 },
      damage: { made: 1000, received: 1000 } },
    teams: { red: 13, blue: 11 },
  }));
  assert.ok(new TextEncoder().encode(JSON.stringify(data)).byteLength > 1_800_000);
  await writeProfileSnapshot("long-history", data);
  const response = [...store.values()][0];
  assert.ok((await response.clone().arrayBuffer()).byteLength < 1_800_000);
  resetProfileCache();
  const restored = await readProfileSnapshot("long-history", Date.now() + 1000);
  assert.ok(restored, "large snapshot did not survive the codec round trip");
  assert.deepEqual(restored, data);
  assert.equal(restored?.storedMatches.length, 5000);
});

test("incompressible oversized snapshots cannot exceed the encoded size cap", async () => {
  const store = edgeStore();
  const data = snapshot();
  data.bundle.profile.name = randomBytes(2_000_000).toString("base64");
  await writeProfileSnapshot("random", data);
  assert.equal(store.size, 0);
  assert.equal(await readProfileSnapshot("random", Date.now() + 1000), null);
});

test("inflation is bounded even when encoded bytes are small", async () => {
  const store = edgeStore();
  const stream = new Blob(["x".repeat(8_000_001)]).stream().pipeThrough(new CompressionStream("gzip"));
  store.set("https://profile-cache.internal/v2/expansion", new Response(await new Response(stream).arrayBuffer()));
  assert.equal(await readProfileSnapshot("expansion", Date.now() + 1000), null);
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

test("an abandoned deferred refresh cannot disable future refreshes indefinitely", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
  const tasks: (() => Promise<void>)[] = [];
  const defer = (task: () => Promise<void>) => { tasks.push(task); };
  let calls = 0;
  refreshProfileSnapshot("player", defer, async () => { calls++; });
  t.mock.timers.tick(46_000);
  refreshProfileSnapshot("player", defer, async () => { calls++; });
  assert.equal(tasks.length, 2, "wall-clock expiry must not depend on the old context running a timer");
  await tasks[0]();
  assert.equal(calls, 0, "a delayed, superseded callback must not start duplicate work");
  await tasks[1]();
  assert.equal(calls, 1);
});

test("late cleanup from an old refresh cannot clear a newer lease", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
  const tasks: (() => Promise<void>)[] = [];
  const defer = (task: () => Promise<void>) => { tasks.push(task); };
  const oldWork = Promise.withResolvers<void>();
  refreshProfileSnapshot("player", defer, () => oldWork.promise);
  const old = tasks[0]();
  t.mock.timers.tick(46_000);
  refreshProfileSnapshot("player", defer, async () => {});
  oldWork.resolve();
  await old;
  refreshProfileSnapshot("player", defer, async () => {});
  assert.equal(tasks.length, 2, "replacement must still dedupe until its own callback runs");
  await tasks[1]();
});
