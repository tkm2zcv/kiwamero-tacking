import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { execute } from "../src/lib/db.ts";
import { resetHenrikClient } from "../src/lib/henrik-client.ts";
import { resetRateLimitBuckets } from "../src/lib/rate-limit-core.ts";

process.env.DATABASE_URL = "file::memory:";
// Rewrites "@/", "server-only", "@/lib/auth" and the CJS "next/server" entry.
register("./route-hooks.mjs", import.meta.url);

const KEY = `kt_${"ab".repeat(32)}`;
const AUTH: Record<string, string> = {
  authorization: `Bearer ${KEY}`, "sec-fetch-site": "same-origin",
};
const realFetch = globalThis.fetch;
const upstream: string[] = [];
let GET: (typeof import("../src/app/api/valorant/matches/[name]/[tag]/route.ts"))["GET"];
let NextRequest: typeof import("next/server").NextRequest;

function call(query: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost/api/valorant/matches/Player/TAG${query}`, {
    headers: { ...AUTH, ...headers },
  });
  return GET(req, { params: Promise.resolve({ name: "Player", tag: "TAG" }) });
}

const account = () => Response.json({
  status: 200,
  data: { puuid: "p-1", region: "ap", name: "Player", tag: "TAG" },
});

test.before(async () => {
  for (const s of fs.readFileSync("db/upgrade-2026-10-30.sql", "utf8").split(";").filter((s) => s.trim())) await execute(s);
  await execute(`CREATE TABLE IF NOT EXISTS "ApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "key" TEXT NOT NULL,
    "label" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" DATETIME)`);
  await execute(`CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL, "providerId" TEXT NOT NULL)`);
  await execute(`INSERT INTO "Account"("id", "userId", "accountId", "providerId")
    VALUES ('a1', 'u1', 'disc-owner', 'discord')`);
  // kt_ keys authorize only while their issuer stays allowlisted.
  process.env.OWNER_DISCORD_IDS = "disc-owner";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(KEY));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  await execute(`INSERT INTO "ApiKey"("id", "userId", "key") VALUES ('k1', 'u1', ?)`, [`sha256:${hash}`]);
  process.env.HENRIK_API_KEYS = "hd-route-test";
  ({ GET } = await import("../src/app/api/valorant/matches/[name]/[tag]/route.ts"));
  ({ NextRequest } = await import("next/server"));
});
test.afterEach(async () => {
  for (const table of ["MatchArchive", "HenrikQuota"]) await execute(`DELETE FROM ${table}`);
  globalThis.fetch = realFetch;
  upstream.length = 0;
  resetHenrikClient();
  resetRateLimitBuckets();
});

test("size is clamped and mode is allowlisted before reaching the upstream URL", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    upstream.push(url);
    if (url.includes("/valorant/v1/account/")) return account();
    return Response.json({ status: 200, data: [] });
  };
  const res = await call("?size=999&mode=bogus");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const matchesUrl = upstream.find((u) => u.includes("/v3/by-puuid/matches/"))!;
  assert.ok(matchesUrl.includes("size=30"), `expected size clamp, got ${matchesUrl}`);
  assert.ok(!matchesUrl.includes("mode="), `allowlist rejected bogus mode: ${matchesUrl}`);
});

test("a valid mode and in-range size pass through unchanged", async () => {
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    upstream.push(url);
    if (url.includes("/valorant/v1/account/")) return account();
    return Response.json({ status: 200, data: [] });
  };
  const res = await call("?mode=premier&size=3");
  assert.equal(res.status, 200);
  const matchesUrl = upstream.find((u) => u.includes("/v3/by-puuid/matches/"))!;
  assert.ok(matchesUrl.includes("mode=premier") && matchesUrl.includes("size=3"), matchesUrl);
});

test("upstream failures return a generic body, never exception text", async () => {
  globalThis.fetch = async () => new Response("boom", { status: 500 });
  const errors: unknown[] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const res = await call("");
    assert.equal(res.status, 502);
    const body = await res.json() as Record<string, unknown>;
    assert.deepEqual(body, { error: "upstream unavailable" });
    assert.ok(!JSON.stringify(body).includes("HenrikDev"));
  } finally {
    console.error = realError;
  }
  assert.equal(errors.length, 1, "the failure is logged server-side");
});

test("cross-site initiated requests are refused before auth or upstream spend", async () => {
  globalThis.fetch = async (input) => { upstream.push(String(input)); return account(); };
  const res = await call("", { "sec-fetch-site": "cross-site" });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: "forbidden" });
  assert.equal(upstream.length, 0);
});
