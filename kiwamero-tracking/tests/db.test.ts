import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Point the local sqlite fallback at an in-memory database before the first
// query. `node --test` runs each test file in its own process.
process.env.DATABASE_URL = "file::memory:";

process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-32";
process.env.BETTER_AUTH_URL = "http://localhost:3002";

import { execute, queryAll, queryOne } from "../src/lib/db.ts";
import { watchDb } from "../src/lib/watch-db.ts";
import type { WatchlistEntryRow } from "../src/lib/db-schema.ts";


let schemaApplied = false;
async function applySchema() {
  if (schemaApplied) return;
  schemaApplied = true;
  const raw = fs.readFileSync(path.join("db", "schema.sql"), "utf8").replace(/^﻿/, "");
  const statements = raw
    .split(";")
    .map((s) => s.replace(/--[^\n]*/g, "").trim())
    .filter(Boolean);
  for (const stmt of statements) await execute(stmt);
}

test("raw SQL helpers + watchDb over real schema", async () => {
  await applySchema();

  const now = new Date("2026-10-29T00:00:00.000Z");
  await execute(
    `INSERT INTO "User" ("id", "name", "emailVerified", "webhookUrl", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?, ?)`,
    ["u1", "alice", true, "https://discord.com/api/webhooks/1/token-abcdefghijklmnop", now, now],
  );
  await execute(
    `INSERT INTO "User" ("id", "name", "emailVerified", "createdAt", "updatedAt")
     VALUES (?, ?, ?, ?, ?)`,
    ["u2", "bob", false, now, now],
  );
  await execute(
    `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag", "puuid", "region", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ["e1", "u1", "Meiy", "B3L", "puuid-1", "ap", now],
  );
  await execute(
    `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag", "createdAt")
     VALUES (?, ?, ?, ?, ?)`,
    ["e2", "u2", "Nobody", "TAG", now],
  );

  // Dates are stored as ISO strings; booleans as 0/1.
  const u1 = await queryOne<{ emailVerified: number; webhookUrl: string; createdAt: string }>(
    `SELECT "emailVerified", "webhookUrl", "createdAt" FROM "User" WHERE "id" = ?`,
    ["u1"],
  );
  assert.equal(u1?.emailVerified, 1);
  assert.match(u1!.createdAt, /^2026-10-29T00:00:00/);
  assert.match(u1!.webhookUrl, /webhooks\/1\//);
  assert.equal(await queryOne(`SELECT "id" FROM "User" WHERE "id" = ?`, ["missing"]), null);

  // watchDb.findMany: only entries whose user has a webhook, nested user shape.
  const rows = await watchDb.watchlistEntry.findMany({ take: 100 });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "e1");
  assert.equal(rows[0].user.webhookUrl, u1!.webhookUrl);

  // userId filter still applies on top of the webhook join.
  assert.equal((await watchDb.watchlistEntry.findMany({ where: { userId: "u2" } })).length, 0);
  assert.equal((await watchDb.watchlistEntry.findMany({ where: { userId: "u1" } })).length, 1);

  // watchDb.update advances the notification cursor.
  await watchDb.watchlistEntry.update({
    where: { id: "e1" },
    data: { lastSeenGameStart: 12345, lastNotifiedMatchId: "m-1", lastNotifiedAt: new Date("2026-10-29T01:00:00Z") },
  });
  const updated = await queryOne<WatchlistEntryRow>(`SELECT * FROM "WatchlistEntry" WHERE "id" = ?`, ["e1"]);
  assert.equal(updated?.lastSeenGameStart, 12345);
  assert.equal(updated?.lastNotifiedMatchId, "m-1");
  assert.match(updated!.lastNotifiedAt!, /^2026-10-29T01:00:00/);

  // INSERT ... ON CONFLICT ... RETURNING used by POST /api/watchlist.
  const upserted = await queryAll<WatchlistEntryRow>(
    `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag", "puuid", "region", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT ("userId", "riotName", "riotTag")
     DO UPDATE SET "puuid" = excluded."puuid", "region" = excluded."region"
     RETURNING *`,
    ["e3", "u1", "Meiy", "B3L", "puuid-2", "na", new Date()],
  );
  assert.equal(upserted.length, 1);
  assert.equal(upserted[0].id, "e1");
  assert.equal(upserted[0].puuid, "puuid-2");
  assert.equal(upserted[0].region, "na");
});

/**
 * The Better Auth kysely adapter must resolve the PascalCase table names and
 * run real SQL through the lazy backend — this is what would break on Workers
 * if the database wiring were wrong (the same path the OAuth callback uses).
 */
test("better-auth adapter reads/writes the real schema", async () => {
  await applySchema();
  const { auth } = await import("../src/lib/auth.ts");
  const ctx = await auth.$context;

  const user = await ctx.internalAdapter.createUser(
    { email: "t@example.com", name: "tester" },
    { method: "oauth", oauth: { providerId: "discord" } },
  );
  assert.ok(user.id);

  const session = await ctx.internalAdapter.createSession(user.id, false);
  assert.ok(session.token);

  const found = await ctx.internalAdapter.findSession(session.token);
  assert.equal(found?.user.id, user.id);

  const account = await ctx.internalAdapter.createAccount({
    userId: user.id,
    accountId: "12345",
    providerId: "discord",
  });
  const linked = await queryOne<{ accountId: string }>(
    `SELECT "accountId" FROM "Account" WHERE "userId" = ? AND "providerId" = 'discord'`,
    [user.id],
  );
  assert.equal(linked?.accountId, account.accountId);
});
