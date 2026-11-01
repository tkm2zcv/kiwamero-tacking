import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { betterAuth } from "better-auth";
import { serializeSignedCookie } from "better-call";
import { execute, resolveBackend } from "../src/lib/db.ts";
import { beforeDeadline } from "../src/lib/deadline.ts";
import { allowedDiscordAccess } from "../src/lib/owner-access-core.ts";

process.env.DATABASE_URL = "file::memory:";
process.env.BETTER_AUTH_SECRET = "offline-auth-runtime-secret-long-enough-32";
process.env.BETTER_AUTH_URL = "http://localhost:3002";

test("session and owner checks do not depend on an isolate-global schema probe", { timeout: 10_000 }, async () => {
  const sql = fs.readFileSync("db/schema.sql", "utf8").replace(/^\uFEFF/, "");
  for (const statement of sql.split(";").map(s => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean)) {
    await execute(statement);
  }
  const backend = await resolveBackend();
  const run = backend.run.bind(backend);
  const blockedIntrospection = Promise.withResolvers<void>();
  const fetch = globalThis.fetch;
  const owners = process.env.OWNER_DISCORD_IDS;
  let introspections = 0;
  // Fault injection only at the I/O boundary: all session SQL and signatures
  // still use the real Better Auth adapter and checked-in database schema.
  backend.run = async (query, params) => {
    if (/sqlite_master|sqlite_schema|pragma_/i.test(query)) {
      introspections++;
      await blockedIntrospection.promise;
    }
    return run(query, params);
  };
  globalThis.fetch = async () => { throw new Error("Auth regression must not access the network"); };
  let explicitCheck: (() => Promise<void> | undefined) | undefined;
  try {
    const { auth } = await import("../src/lib/auth.ts");
    // A fresh instance exercises bootstrap rather than a previously clean check.
    const probe = betterAuth(auth.options);
    const sessionFor = (cookie?: string) => beforeDeadline(
      probe.api.getSession({ headers: new Headers(cookie ? { cookie } : {}) }), Date.now() + 2000,
    );
    assert.equal(await sessionFor(), null, "even cookie-free access must not wait on introspection");
    const ctx = await probe.$context;
    explicitCheck = () => ctx.explicitSchemaCheck?.();
    const user = await ctx.internalAdapter.createUser(
      { email: "auth-runtime@example.test", name: "runtime-probe" },
      { method: "oauth", oauth: { providerId: "discord" } },
    );
    const discordId = "111111111111111111";
    await ctx.internalAdapter.createAccount({ userId: user.id, accountId: discordId, providerId: "discord" });
    const session = await ctx.internalAdapter.createSession(user.id, false);
    const cookie = (await serializeSignedCookie(ctx.authCookies.sessionToken.name, session.token, ctx.secret)).split(";")[0];
    const valid = await sessionFor(cookie);
    assert.equal(valid?.user.id, user.id);
    process.env.OWNER_DISCORD_IDS = discordId;
    assert.equal((await allowedDiscordAccess(valid))?.userId, user.id);
    process.env.OWNER_DISCORD_IDS = "222222222222222222";
    assert.equal(await allowedDiscordAccess(valid), null, "allowlist removal still denies the live session");
    assert.equal(await sessionFor(`${cookie}tampered`), null, "signature validation remains mandatory");
    await execute('UPDATE "Session" SET "expiresAt" = ? WHERE "id" = ?', ["2000-01-01T00:00:00.000Z", session.id]);
    assert.equal(await sessionFor(cookie), null, "expired sessions cannot bypass DB validation");
    assert.equal(introspections, 0, "runtime auth must never inherit pending schema I/O");
  } finally {
    blockedIntrospection.resolve();
    backend.run = run;
    globalThis.fetch = fetch;
    if (owners === undefined) delete process.env.OWNER_DISCORD_IDS;
    else process.env.OWNER_DISCORD_IDS = owners;
  }
  assert.ok(explicitCheck, "manual compatibility validation remains available");
  await explicitCheck();
});
