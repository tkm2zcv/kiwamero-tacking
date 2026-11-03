import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execute } from "../src/lib/db.ts";
import {
  readDurableProfile, writeDurableProfile, invalidateDurableProfile,
  claimProfileRefresh, releaseProfileRefresh,
} from "../src/lib/profile-db.ts";
process.env.DATABASE_URL = "file::memory:";
const packed = new Uint8Array([1, 2, 3]).buffer;
test.before(async () => {
  for (const s of fs.readFileSync("db/upgrade-2026-11-04-profiles.sql", "utf8").split(";").filter((s) => s.trim())) await execute(s);
});
test.afterEach(async () => { await execute("DELETE FROM ProfileSnapshot"); });
test("BLOB snapshots persist, isolate keys and reject older writers", async () => {
  assert.ok(await writeDurableProfile("a", "player", packed, 200));
  assert.equal(await writeDurableProfile("a", "player", new Uint8Array([9]).buffer, 100), false);
  assert.deepEqual(await readDurableProfile("a"), packed);
  assert.equal(await readDurableProfile("b"), null);
});
test("invalidation fences prevent late in-flight writes from reviving revoked profiles", async () => {
  const captured = Date.now() - 1000;
  await writeDurableProfile("a", "player", packed, captured);
  await invalidateDurableProfile("a");
  assert.equal(await writeDurableProfile("a", "player", packed, captured), false);
  assert.equal(await readDurableProfile("a"), null);
});
test("refresh claims are atomic across workers and cooldowns survive fresh callers", async () => {
  const claims = await Promise.all(Array.from({ length: 10 }, () => claimProfileRefresh("a", 1000)));
  assert.equal(claims.filter(Boolean).length, 1);
  assert.equal(await claimProfileRefresh("a", 120999), null);
  const next = await claimProfileRefresh("a", 121000);
  assert.ok(next);
  await releaseProfileRefresh("a", claims.find(Boolean)!);
  assert.equal(await claimProfileRefresh("a", 121001), null, "stale release must not unlock the replacement");
  await releaseProfileRefresh("a", next);
  assert.equal(await claimProfileRefresh("a"), null, "cooldown keeps failing profiles from refreshing every view");
});
