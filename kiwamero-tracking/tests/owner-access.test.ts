import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Point the local sqlite fallback at an in-memory database before the first
// query. `node --test` runs each test file in its own process.
process.env.DATABASE_URL = "file::memory:";

import { execute } from "../src/lib/db.ts";
import {
  allowedDiscordAccess,
  liveApiKeyCount,
  MAX_API_KEYS_PER_USER,
  resolveApiKeyAccess,
} from "../src/lib/owner-access-core.ts";

const LIVE_KEY = `kt_${"11".repeat(32)}`;
const FORMER_KEY = `kt_${"22".repeat(32)}`;
const REVOKED_KEY = `kt_${"33".repeat(32)}`;

const bearer = (key: string) => new Headers({ authorization: `Bearer ${key}` });

let schemaApplied = false;
async function applySchema() {
  if (schemaApplied) return;
  schemaApplied = true;
  const raw = fs.readFileSync(path.join("db", "schema.sql"), "utf8").replace(/^﻿/, "");
  for (const stmt of raw.split(";").map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean)) {
    await execute(stmt);
  }
  const now = new Date("2026-10-30T00:00:00.000Z");
  for (const [id, discordId] of [["u-live", "disc-live"], ["u-former", "disc-former"]] as const) {
    await execute(
      `INSERT INTO "User" ("id", "name", "createdAt", "updatedAt") VALUES (?, ?, ?, ?)`,
      [id, id, now, now],
    );
    await execute(
      `INSERT INTO "Account" ("id", "userId", "accountId", "providerId", "createdAt", "updatedAt")
       VALUES (?, ?, ?, 'discord', ?, ?)`,
      [`acc-${id}`, id, discordId, now, now],
    );
  }
}

/** Insert an ApiKey row exactly as POST /api/keys does: sha256:<hash>, optional revocation. */
async function seedKey(id: string, userId: string, rawKey: string, revoked = false) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  await execute(
    `INSERT INTO "ApiKey" ("id", "userId", "key", "createdAt", "revokedAt") VALUES (?, ?, ?, ?, ?)`,
    [id, userId, `sha256:${hash}`, new Date(), revoked ? new Date() : null],
  );
  return `key:${hash.slice(0, 16)}`;
}

test.before(async () => {
  await applySchema();
  process.env.OWNER_DISCORD_IDS = "disc-live";
  await seedKey("k-live", "u-live", LIVE_KEY);
  await seedKey("k-former", "u-former", FORMER_KEY);
  await seedKey("k-revoked", "u-live", REVOKED_KEY, true);
});

test("a live owner's kt_ key still resolves to its credential bucket", async () => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(LIVE_KEY));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  assert.deepEqual(await resolveApiKeyAccess(bearer(LIVE_KEY)), {
    userId: null,
    rateLimitKey: `key:${hash.slice(0, 16)}`,
  });
});

test("a de-allowlisted issuer's kt_ key is denied", async () => {
  assert.equal(await resolveApiKeyAccess(bearer(FORMER_KEY)), null);
});

test("revoked, unknown and malformed keys are denied", async () => {
  assert.equal(await resolveApiKeyAccess(bearer(REVOKED_KEY)), null);
  assert.equal(await resolveApiKeyAccess(bearer(`kt_${"44".repeat(32)}`)), null);
  assert.equal(await resolveApiKeyAccess(new Headers({ authorization: "Bearer kt_short" })), null);
  assert.equal(await resolveApiKeyAccess(new Headers()), null);
  assert.equal(await resolveApiKeyAccess(new Headers({ authorization: "Basic abc" })), null);
});

test("an empty OWNER_DISCORD_IDS denies every kt_ key", async () => {
  const prev = process.env.OWNER_DISCORD_IDS;
  process.env.OWNER_DISCORD_IDS = "";
  try {
    assert.equal(await resolveApiKeyAccess(bearer(LIVE_KEY)), null);
  } finally {
    process.env.OWNER_DISCORD_IDS = prev;
  }
});

test("allowedDiscordAccess still binds sessions to the allowlist", async () => {
  const access = await allowedDiscordAccess({ user: { id: "u-live" } });
  assert.equal(access?.userId, "u-live");
  assert.equal(access?.discordId, "disc-live");
  assert.equal(await allowedDiscordAccess({ user: { id: "u-former" } }), null);
  assert.equal(await allowedDiscordAccess(null), null);
});

test("liveApiKeyCount drives the POST /api/keys mint cap", async () => {
  // u-live holds 1 live + 1 revoked key; revoked rows must not count.
  assert.equal(await liveApiKeyCount("u-live"), 1);
  assert.equal(await liveApiKeyCount("u-former"), 1);
  for (let i = 1; i < MAX_API_KEYS_PER_USER; i++) {
    await seedKey(`cap-${i}`, "u-live", `kt_${String(i).padStart(2, "0")}${"aa".repeat(31)}`);
  }
  // At the cap: the 11th mint hits `count >= MAX_API_KEYS_PER_USER` -> 409.
  assert.equal(await liveApiKeyCount("u-live"), MAX_API_KEYS_PER_USER);
  assert.ok((await liveApiKeyCount("u-live")) >= MAX_API_KEYS_PER_USER);
});
