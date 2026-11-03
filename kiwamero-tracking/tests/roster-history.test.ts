import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { register } from "node:module";
import { execute, queryOne } from "../src/lib/db.ts";
import {
  enqueueRosterHistory, rosterHistoryProgress, claimRosterHistory, finishRosterPage,
  failRosterPage, releaseCompletedRosterHistories, type RosterJob,
} from "../src/lib/roster-history.ts";
import { runRosterQueue } from "../src/lib/roster-run.ts";
import { readArchivedMatches, rememberMatch, gcMatchArchive } from "../src/lib/match-archive.ts";
import { resetHenrikClient } from "../src/lib/henrik-client.ts";
import { HenrikDevError } from "../src/lib/henrik-errors.ts";
import { getRosterPage } from "../src/lib/henrikdev.ts";
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
  for (const name of ["HENRIK_API_KEYS", "HENRIK_API_KEY", "HENRIK_KEY_RPM", "HENRIK_BACKGROUND_RPM"]) delete process.env[name];
});
const state = () => queryOne<RosterJob>("SELECT * FROM RosterHistory WHERE puuid = ?", [selfId]);
const ids = (n: number) => Array.from({ length: n }, (_, i) => matchId(i + 1));
function pages(total: number, order?: number[]) {
  const starts: number[] = [];
  process.env.HENRIK_API_KEYS = "offline-test-key";
  process.env.HENRIK_KEY_RPM = "1000"; process.env.HENRIK_BACKGROUND_RPM = "999";
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.ok(url.pathname.includes("/v4/by-puuid/matches/ap/pc/"));
    const size = Number(url.searchParams.get("size"));
    assert.ok(size >= 1 && size <= 10);
    const start = Number(url.searchParams.get("start")); starts.push(start);
    return Response.json({ status: 200, data: Array.from({ length: Math.max(0, Math.min(size, total - start)) },
      (_, i) => v4Match(order?.[start + i] ?? start + i + 1)) });
  };
  return starts;
}

test("703 known matches queue only the latest50, resume and revisit without duplicate calls", async () => {
  const starts = pages(703);
  await enqueueRosterHistory(selfId, "ap", ids(703));
  await runRosterQueue({ maxPages: 2 });
  assert.equal((await state())!.cursor, 20);
  resetHenrikClient();
  await runRosterQueue();
  assert.deepEqual(starts, [0, 10, 20, 30, 40]);
  assert.deepEqual(await rosterHistoryProgress(selfId), {
    active: false, blocked: false, cursor: 50, exhausted: true,
    expected: 50, cached: 50, unavailable: 0, pending: 0,
  });
  assert.equal((await readArchivedMatches(ids(703))).size, 50);
  assert.equal(await queryOne("SELECT matchId FROM MatchArchive WHERE matchId = ?", [matchId(51)]), null);
  await enqueueRosterHistory(selfId, "ap", [...ids(703), matchId(1)]);
  await runRosterQueue();
  assert.equal(starts.length, 5, "revisits do not refetch completed history");
});

test("all cached history costs no provider calls; newly discovered IDs restart the completed scan", async () => {
  const starts = pages(11);
  for (let i = 1; i <= 10; i++) await rememberMatch(rawMatch(i));
  await enqueueRosterHistory(selfId, "ap", ids(10));
  await runRosterQueue();
  assert.equal(starts.length, 0);
  await enqueueRosterHistory(selfId, "ap", ids(11));
  await runRosterQueue();
  assert.deepEqual(starts, [10]);
  assert.equal((await rosterHistoryProgress(selfId)).cached, 11);
});

test("large v4 wire pages are not retained in the generic isolate response cache", async () => {
  const starts = pages(10);
  const first = await getRosterPage("ap", selfId, 0);
  await getRosterPage("ap", selfId, 0);
  assert.deepEqual(starts, [0, 0]);
  assert.equal(first.matches.length, 10);
  assert.equal(first.matches[0].rounds, undefined);
});

test("concurrent claims and stale page completions cannot move another worker's cursor", async () => {
  await enqueueRosterHistory(selfId, "ap", ids(20));
  const jobs = await Promise.all(Array.from({ length: 10 }, () => claimRosterHistory(1000)));
  assert.equal(jobs.filter(Boolean).length, 1);
  const first = jobs.find(Boolean)!;
  const second = await claimRosterHistory(121001);
  assert.ok(second);
  await finishRosterPage(first, 10, "stale");
  assert.equal((await state())!.cursor, 0);
  await finishRosterPage(second, 10, "fresh");
  assert.equal((await state())!.cursor, 10);
});

test("429 keeps the cursor and retry budget, survives refresh and resumes after cooldown", async () => {
  await enqueueRosterHistory(selfId, "ap", ids(20));
  const job = await claimRosterHistory(1000);
  await failRosterPage(job!, new HenrikDevError(429, "quota", 90), 1000);
  assert.equal((await state())!.attempts, 0);
  await enqueueRosterHistory(selfId, "ap", ids(20));
  assert.equal((await state())!.retryAt, 91000);
  assert.equal(await claimRosterHistory(90000), null);
  assert.ok(await claimRosterHistory(91000));
});

test("null slots advance by received rows; only gaps use the per-ID fallback", async () => {
  process.env.HENRIK_API_KEYS = "offline-test-key";
  const starts: number[] = [];
  await enqueueRosterHistory(selfId, "ap", ids(3));
  globalThis.fetch = async (input) => {
    const start = Number(new URL(String(input)).searchParams.get("start")); starts.push(start);
    return Response.json({ status: 200, data: start === 0 ? [v4Match(1), null, v4Match(3)] : [] });
  };
  await runRosterQueue();
  assert.deepEqual(starts, [0]);
  assert.equal((await state())!.exhausted, 1);
  assert.equal((await rosterHistoryProgress(selfId)).cached, 2);
  const gap = await queryOne<{ payload: string | null }>("SELECT payload FROM MatchArchive WHERE matchId = ?", [matchId(2)]);
  assert.equal(gap?.payload, null);
  await execute("UPDATE MatchArchive SET terminal = 1, lastStatus = 404 WHERE matchId = ?", [matchId(2)]);
  await releaseCompletedRosterHistories();
  assert.equal((await rosterHistoryProgress(selfId)).unavailable, 1);
  assert.equal((await state())!.active, 0);
});

test("repeated pages cannot loop forever, and fallback retries survive archive GC", async () => {
  process.env.HENRIK_API_KEYS = "offline-test-key";
  await enqueueRosterHistory(selfId, "ap", ids(11));
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ status: 200,
    data: Array.from({ length: 10 }, (_, i) => v4Match(i + 1)) }); };
  await runRosterQueue();
  assert.equal(calls, 2);
  assert.equal((await state())!.exhausted, 1);
  await execute("UPDATE MatchArchive SET attempts = 2, terminal = 1 WHERE matchId = ?", [matchId(11)]);
  await gcMatchArchive();
  assert.ok(await queryOne("SELECT matchId FROM MatchArchive WHERE matchId = ?", [matchId(11)]));
});

test("invalid targets are rejected, 403 blocks instead of retrying on every render", async () => {
  await assert.rejects(enqueueRosterHistory("not-a-puuid", "ap", ids(1)));
  await enqueueRosterHistory(selfId, "ap", [matchId(1), "not-a-match"]);
  const job = await claimRosterHistory(1000);
  await failRosterPage(job!, new HenrikDevError(403, "forbidden"), 1000);
  await enqueueRosterHistory(selfId, "ap", ids(2));
  assert.equal((await state())!.blocked, 1);
  assert.equal(await claimRosterHistory(999999), null);
});
