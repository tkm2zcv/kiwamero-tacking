import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execute, queryAll, queryOne } from "../src/lib/db.ts";
import { reserveQuota, coolQuota, retryAfterMs } from "../src/lib/henrik-quota.ts";
import { archivedMatch, claimMatch, finishMatch, failMatch, readArchivedMatch, rememberMatch } from "../src/lib/match-archive.ts";
import { enqueueAudit, auditCoverage, loadAuditHistory, releaseCompletedAudits, repairAuditManifest } from "../src/lib/audit-history.ts";
import { runAuditQueue } from "../src/lib/audit-run.ts";
import { resetHenrikClient } from "../src/lib/henrik-client.ts";
import { HenrikDevError } from "../src/lib/henrik-errors.ts";
import { rawMatch, matchId, selfId, stored } from "./history-fixtures.ts";

process.env.DATABASE_URL = "file::memory:";
const realFetch = globalThis.fetch;
test.before(async () => {
  for (const s of fs.readFileSync("db/upgrade-2026-10-30.sql", "utf8").split(";").filter((s) => s.trim())) await execute(s);
});
test.afterEach(async () => {
  for (const table of ["AuditMatch", "AuditHistory", "MatchArchive", "HenrikQuota"]) await execute(`DELETE FROM ${table}`);
  for (const key of ["HENRIK_KEY_RPM", "HENRIK_BACKGROUND_RPM", "HENRIK_QUOTA_SCOPE"]) delete process.env[key];
  delete process.env.HENRIK_API_KEYS;
  globalThis.fetch = realFetch;
  resetHenrikClient();
});

test("rolling quota is atomic under concurrency; foreground keeps its reserved capacity", async () => {
  const results = await Promise.all(Array.from({ length: 50 }, () => reserveQuota("only-test-key", "background", 100000)));
  assert.equal(results.filter((r) => r.ok).length, 20);
  const foreground = await Promise.all(Array.from({ length: 20 }, () => reserveQuota("only-test-key", "interactive", 100000)));
  assert.equal(foreground.filter((r) => r.ok).length, 10);
  assert.equal((await reserveQuota("only-test-key", "interactive", 159999)).ok, false);
  assert.equal((await reserveQuota("only-test-key", "interactive", 160000)).ok, true);
  const state = await queryOne<{ keyHash: string; uses: string }>("SELECT keyHash, uses FROM HenrikQuota");
  assert.ok(!state?.keyHash.includes("only-test-key"));
  assert.equal(JSON.parse(state!.uses).length, 1);
});

test("four independent keys and explicitly shared quotas have distinct behavior", async () => {
  const keys = ["a", "b", "c", "d"];
  const slots = await Promise.all(keys.flatMap((key) => Array.from({ length: 35 }, () => reserveQuota(key, "interactive", 100000))));
  assert.equal(slots.filter((r) => r.ok).length, 120);
  process.env.HENRIK_QUOTA_SCOPE = "shared";
  const shared = await Promise.all(keys.flatMap((key) => Array.from({ length: 15 }, () => reserveQuota(key, "interactive", 100000))));
  assert.equal(shared.filter((r) => r.ok).length, 30);
});

test("cooldowns persist beyond in-process client state and honor HTTP-date Retry-After", async () => {
  await coolQuota("cooled", 200000);
  assert.equal((await reserveQuota("cooled", "interactive", 100000)).ok, false);
  assert.equal((await reserveQuota("cooled", "interactive", 200000)).ok, true);
  assert.equal(retryAfterMs("5", 0), 5000);
  assert.equal(retryAfterMs("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60000);
  assert.equal(retryAfterMs("invalid", 0), 60000);
});

test("persistent archive coalesces concurrent requests and survives fresh callers", async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return rawMatch(1); };
  await Promise.all(Array.from({ length: 10 }, () => archivedMatch(matchId(1), fetcher)));
  assert.equal(calls, 1);
  await archivedMatch(matchId(1), async () => { throw new Error("must not fetch"); });
  assert.equal((await readArchivedMatch(matchId(1)))?.metadata.matchid, matchId(1));
  const state = await queryOne<{ payload: string }>("SELECT payload FROM MatchArchive");
  assert.ok(!("rounds" in JSON.parse(state!.payload)));
});

test("expired leases can be reclaimed; stale owners cannot publish or fail a new lease", async () => {
  const first = await claimMatch(matchId(1), 100000);
  assert.ok(first);
  assert.equal(await claimMatch(matchId(1), 100001), null);
  const second = await claimMatch(matchId(1), 220001);
  assert.ok(second);
  assert.equal(await finishMatch(matchId(1), first.token, rawMatch(1)), null);
  await failMatch(matchId(1), first.token, 1, new Error("stale"), 220001);
  assert.ok(await finishMatch(matchId(1), second.token, rawMatch(1)));
});

test("429 defers without exhausting retries; 404 remains unavailable, not a zero-stat match", async () => {
  const claim = await claimMatch(matchId(1), 100000);
  await failMatch(matchId(1), claim!.token, 1, new HenrikDevError(429, "quota", 90), 100000);
  let state = await queryOne<{ retryAt: number; attempts: number; terminal: number }>("SELECT * FROM MatchArchive");
  assert.equal(state!.retryAt, 190000);
  assert.equal(state!.attempts, 0);
  assert.equal(state!.terminal, 0);
  const retry = await claimMatch(matchId(1), 190000);
  await failMatch(matchId(1), retry!.token, 1, new HenrikDevError(404, "missing"), 190000);
  state = await queryOne("SELECT * FROM MatchArchive");
  assert.equal(state!.terminal, 1);
  assert.equal(await readArchivedMatch(matchId(1)), null);
});

test("malformed full-detail responses cannot enter the persistent cache", async () => {
  const partial = rawMatch(1);
  partial.players = [Array.isArray(partial.players) ? partial.players[0] : partial.players.all_players[0]];
  await assert.rejects(archivedMatch(matchId(1), async () => partial));
  assert.equal(await readArchivedMatch(matchId(1)), null);
  const missingStats = rawMatch(2);
  const people = Array.isArray(missingStats.players) ? missingStats.players : missingStats.players.all_players;
  people[0].stats.score = undefined as unknown as number;
  await assert.rejects(archivedMatch(matchId(2), async () => missingStats), { status: 502 });
  assert.equal(await readArchivedMatch(matchId(2)), null);
});

test("players share one match job; resync retains older retrieved history", async () => {
  await enqueueAudit({ puuid: selfId, name: "Player", tag: "TAG", region: "ap", rows: [stored(1), stored(2)] });
  await enqueueAudit({ puuid: "other", name: "Other", tag: "TAG", region: "ap", rows: [stored(1)] });
  assert.equal((await queryAll("SELECT * FROM MatchArchive")).length, 2);
  await rememberMatch(rawMatch(1));
  let status = await auditCoverage(selfId);
  assert.equal(status.cached, 1); assert.equal(status.pending, 1);
  assert.equal(status.periods[0].total, 2);
  assert.equal(status.periods[0].cached, 1);
  assert.equal(status.periods[0].period, "e11a6");
  assert.equal((await auditCoverage("other")).unavailable, 1, "missing owner must not count as analyzed");
  await enqueueAudit({ puuid: selfId, name: "Renamed", tag: "NEW", region: "ap", rows: [stored(3)] });
  assert.equal((await loadAuditHistory(selfId)).rows.length, 3);
  status = await auditCoverage(selfId);
  assert.equal(status.total, 3); assert.equal(status.pending, 2);
});

test("global admission remains bounded even when profiles arrive concurrently", async () => {
  const results = await Promise.allSettled(Array.from({ length: 25 }, (_, i) =>
    enqueueAudit({ puuid: `person-${i}`, name: `P${i}`, tag: "TAG", region: "ap", rows: [stored(i + 1)] })));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 20);
  assert.equal((await queryAll("SELECT * FROM AuditHistory WHERE active = 1")).length, 20);
  for (let i = 1; i <= 20; i++) await rememberMatch(rawMatch(i));
  await releaseCompletedAudits();
  assert.equal((await queryAll("SELECT * FROM AuditHistory WHERE active = 1")).length, 0);
});

test("an interrupted manifest stays pending and recovers idempotently", async () => {
  await execute(`INSERT INTO AuditHistory(puuid, riotName, riotTag, region, rowsJson, syncedAt)
    VALUES (?, 'Player', 'TAG', 'ap', ?, ?)`, [selfId, JSON.stringify([stored(1), stored(2)]), Date.now()]);
  const before = await auditCoverage(selfId);
  assert.equal(before.total, 2); assert.equal(before.pending, 2);
  await repairAuditManifest();
  await repairAuditManifest();
  assert.equal((await queryAll("SELECT * FROM AuditMatch")).length, 2);
  assert.equal((await queryAll("SELECT * FROM MatchArchive")).length, 2);
});

test("concurrent resync cannot lose older history or a newly admitted match", async () => {
  const input = { puuid: selfId, name: "Player", tag: "TAG", region: "ap" };
  await enqueueAudit({ ...input, rows: [stored(1)] });
  const updates = [[stored(2)], [stored(3)]];
  const results = await Promise.allSettled(updates.map((rows) => enqueueAudit({ ...input, rows })));
  for (let i = 0; i < results.length; i++) if (results[i].status === "rejected") {
    await enqueueAudit({ ...input, rows: updates[i] });
  }
  assert.equal((await loadAuditHistory(selfId)).rows.length, 3);
  assert.equal((await auditCoverage(selfId)).total, 3);
});

test("the bounded runner prioritizes change windows through the real archive/quota paths", async () => {
  const rows = Array.from({ length: 120 }, (_, i) => stored(i, i >= 40 && i < 80
    ? { kills: 30, deaths: 10, score: 9000, head: 20, body: 4, leg: 0 } : {}));
  await enqueueAudit({ puuid: selfId, name: "Player", tag: "TAG", region: "ap", rows });
  process.env.HENRIK_API_KEYS = "runner-test-a,runner-test-b";
  const fetched: number[] = [];
  globalThis.fetch = async (input) => {
    const i = Number(String(input).split("-").at(-1));
    fetched.push(i);
    return Response.json({ status: 200, data: rawMatch(i) });
  };
  const summary = await runAuditQueue({ maxMatches: 2, maxMs: 2000 });
  assert.deepEqual(summary, { completed: 2, failed: 0, deferred: 0 });
  assert.equal(fetched.length, 2);
  assert.ok(fetched.every((i) => i >= 20 && i < 100), "candidate context comes before oldest history");
  const coverage = await auditCoverage(selfId);
  assert.equal(coverage.cached, 2); assert.equal(coverage.pending, 118);
  assert.equal((await queryAll("SELECT * FROM HenrikQuota")).length, 2);
});

test("transient detail failures back off exponentially and stop after five attempts", async () => {
  let now = 100000;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const claim = await claimMatch(matchId(1), now);
    await failMatch(matchId(1), claim!.token, attempt, new HenrikDevError(503, "temporary"), now);
    const row = await queryOne<{ retryAt: number; terminal: number }>("SELECT * FROM MatchArchive");
    assert.equal(row!.retryAt - now, 30000 * 2 ** (attempt - 1));
    assert.equal(row!.terminal, attempt === 5 ? 1 : 0);
    now = row!.retryAt;
  }
  assert.equal(await claimMatch(matchId(1), now), null);
});

test("invalid upstream lookup IDs stay visible as unavailable without being fetched", async () => {
  const coverage = await enqueueAudit({
    puuid: selfId, name: "Player", tag: "TAG", region: "ap", rows: [stored(1, { id: "invalid-upstream-id" })],
  });
  assert.equal(coverage.total, 1);
  assert.equal(coverage.unavailable, 1);
  assert.equal(coverage.pending, 0);
  assert.equal(coverage.state, "partial");
});
