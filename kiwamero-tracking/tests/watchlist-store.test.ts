import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execute } from "../src/lib/db.ts";
import { upsertWatchlistEntry, watchedPlayerCount, watchDb } from "../src/lib/watch-db.ts";

process.env.DATABASE_URL = "file::memory:";

test("atomic watch admission caps concurrent distinct registrations, but permits sharing and updates", async () => {
  const schema = readFileSync("db/schema.sql", "utf8").replace(/^\uFEFF/, "");
  for (const sql of schema.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean)) {
    await execute(sql);
  }
  for (const id of ["owner", "other"]) {
    await execute(
      `INSERT INTO "User" ("id", "name", "updatedAt", "webhookUrl") VALUES (?, ?, ?, ?)`,
      [id, id, new Date(), "https://discord.com/api/webhooks/1/abcdefghijklmnopqrstuvwxyz"],
    );
  }
  for (let i = 0; i < 99; i++) {
    assert.ok(await upsertWatchlistEntry({ userId: "owner", riotName: `Player${i}`, riotTag: "TAG" }));
  }
  const attempts = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    upsertWatchlistEntry({ userId: "other", riotName: `Concurrent${i}`, riotTag: "TAG" }),
  ));
  assert.equal(attempts.filter(Boolean).length, 1);
  assert.equal(await watchedPlayerCount(), 100);
  assert.equal(await upsertWatchlistEntry({ userId: "owner", riotName: "OverLimit", riotTag: "TAG" }), null);

  const shared = await upsertWatchlistEntry({ userId: "other", riotName: "PLAYER0", riotTag: "tag" });
  assert.ok(shared);
  assert.equal(await watchedPlayerCount(), 100);
  const updated = await upsertWatchlistEntry({
    userId: "other", riotName: "PLAYER0", riotTag: "tag", puuid: "updated", region: "ap",
  });
  assert.equal(updated?.id, shared.id);
  assert.equal(updated?.puuid, "updated");
});

test("watchDb has no implicit subscriber row limit", async () => {
  for (let i = 0; i < 10_001; i++) {
    await execute(
      `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag") VALUES (?, ?, ?, ?)`,
      [`subscriber-${i}`, "owner", `Fixture${i}`, "TAG"],
    );
  }
  const rows = await watchDb.watchlistEntry.findMany({ where: { userId: "owner" } });
  assert.ok(rows.length > 10_000);
  assert.equal((await watchDb.watchlistEntry.findMany({ where: { userId: "owner" }, take: 5 })).length, 5);
});
