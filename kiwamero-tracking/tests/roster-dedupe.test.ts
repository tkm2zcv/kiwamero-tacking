import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { execute, queryOne } from "../src/lib/db.ts";
import { enqueueRosterHistory, claimRosterHistory, rosterHistoryProgress, type RosterJob } from "../src/lib/roster-history.ts";
import { runRosterQueue } from "../src/lib/roster-run.ts";
import { readArchivedMatches, rememberMatch } from "../src/lib/match-archive.ts";
import { resetHenrikClient } from "../src/lib/henrik-client.ts";
import { selfId, matchId, rawMatch } from "./history-fixtures.ts";
import { v4Match } from "./roster-fixtures.ts";

process.env.DATABASE_URL = "file::memory:";
register("./route-hooks.mjs", import.meta.url);
const realFetch = globalThis.fetch;
test.before(async () => {
  for (const file of ["db/upgrade-2026-10-30.sql", "db/upgrade-2026-11-04.sql"]) {
    for (const sql of fs.readFileSync(file, "utf8").split(";").filter((s) => s.trim())) await execute(sql);
  }
});
test.afterEach(async () => {
  for (const table of ["RosterHistoryMatch", "RosterHistory", "AuditMatch", "AuditHistory", "MatchArchive", "HenrikQuota"]) {
    await execute(`DELETE FROM ${table}`);
  }
  globalThis.fetch = realFetch; resetHenrikClient();
  delete process.env.HENRIK_API_KEYS;
});
const ids = (n: number) => Array.from({ length: n }, (_, i) => matchId(i + 1));
function mockPages(order = Array.from({ length: 50 }, (_, i) => i + 1)) {
  process.env.HENRIK_API_KEYS = "one,two,three,four";
  const calls: { start: number; size: number; key: string }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const start = Number(url.searchParams.get("start")), size = Number(url.searchParams.get("size"));
    calls.push({ start, size, key: new Headers(init?.headers).get("Authorization")! });
    return Response.json({ status: 200, data: order.slice(start, start + size).map(v4Match) });
  };
  return calls;
}

test("five cold50 calls rotate four keys; overlapping Cron and renders do not duplicate the scan", async () => {
  const calls = mockPages();
  await enqueueRosterHistory(selfId, "ap", ids(50), 1000);
  await Promise.all([runRosterQueue(), runRosterQueue(), enqueueRosterHistory(selfId, "ap", ids(50), 1000)]);
  assert.deepEqual(calls.map((c) => c.start), [0, 10, 20, 30, 40]);
  assert.deepEqual(calls.map((c) => c.key), ["one", "two", "three", "four", "one"]);
  await enqueueRosterHistory(selfId, "ap", ids(50), 1000);
  await runRosterQueue();
  assert.equal(calls.length, 5);
});

test("newest one-match delta fetches only that match, never the previous49", async () => {
  for (let i = 1; i <= 50; i++) await rememberMatch(rawMatch(i));
  await enqueueRosterHistory(selfId, "ap", ids(50), 1000);
  await runRosterQueue({ maxPages: 0 });
  const calls = mockPages([51, ...Array.from({ length: 49 }, (_, i) => i + 1)]);
  await enqueueRosterHistory(selfId, "ap", [matchId(51), ...ids(49)], 2000);
  await runRosterQueue();
  assert.deepEqual(calls.map(({ start, size }) => ({ start, size })), [{ start: 0, size: 1 }]);
  assert.equal((await readArchivedMatches(ids(51))).size, 51, "the old50 archive is retained");
  assert.equal((await rosterHistoryProgress(selfId)).expected, 50);
});

test("cached prefixes and islands are skipped before fetching, including partial last batches", async () => {
  for (const n of [...Array.from({ length: 20 }, (_, i) => i + 1), 31, 32, 33, 34, 35, 46, 47, 48, 49, 50]) {
    await rememberMatch(rawMatch(n));
  }
  const calls = mockPages();
  await enqueueRosterHistory(selfId, "ap", ids(50));
  await runRosterQueue();
  assert.deepEqual(calls.map(({ start, size }) => ({ start, size })),
    [{ start: 20, size: 10 }, { start: 35, size: 10 }]);
  assert.equal((await rosterHistoryProgress(selfId)).cached, 50);
});

test("the shared match archive eliminates a second player's overlapping fetches across concurrent workers", async () => {
  const calls = mockPages();
  const other = "30000000-0000-4000-8000-000000000009";
  await enqueueRosterHistory(selfId, "ap", ids(50));
  await enqueueRosterHistory(other, "ap", ids(50));
  await Promise.all([runRosterQueue(), runRosterQueue()]);
  await runRosterQueue();
  assert.equal(calls.length, 5, "overlapping histories share the same50 rosters");
  assert.equal((await rosterHistoryProgress(other)).cached, 50);
});

test("stale views and leased admissions cannot rewind a current snapshot", async () => {
  await enqueueRosterHistory(selfId, "ap", ids(50), 2000);
  await enqueueRosterHistory(selfId, "ap", [matchId(51)], 1000);
  const job = await claimRosterHistory();
  assert.equal(JSON.parse(job!.targetsJson).length, 50);
  await enqueueRosterHistory(selfId, "ap", [matchId(51)], 3000);
  const current = await queryOne<RosterJob>("SELECT * FROM RosterHistory WHERE puuid = ?", [selfId]);
  assert.equal(current!.targetsJson, job!.targetsJson);
  assert.equal(current!.leaseToken, job!.leaseToken);
});

test("older saved history beyond the archive is queued for unlimited backfill", async () => {
  for (let i = 1; i <= 200; i++) await rememberMatch(rawMatch(i));
  const calls = mockPages(Array.from({ length: 703 }, (_, i) => i + 1));
  await enqueueRosterHistory(selfId, "ap", ids(703));
  for (let i = 0; i < 3; i++) await runRosterQueue({ maxPages: 20 });
  assert.equal((await rosterHistoryProgress(selfId)).expected, 703);
  assert.ok(calls.length > 0, "missing older matches enter the fetch queue");
  assert.equal((await readArchivedMatches(ids(703))).size, 703);
});
