import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { execute, queryOne } from "../src/lib/db.ts";
import { auditCoverage, enqueueAudit, releaseCompletedAudits } from "../src/lib/audit-history.ts";
import { rememberMatch } from "../src/lib/match-archive.ts";
import { rawMatch, selfId, stored } from "./history-fixtures.ts";

process.env.DATABASE_URL = "file::memory:";
test.before(async () => {
  for (const sql of fs.readFileSync("db/upgrade-2026-10-30.sql", "utf8").split(";").filter((s) => s.trim())) {
    await execute(sql);
  }
});
test.afterEach(async () => {
  for (const table of ["AuditMatch", "AuditHistory", "MatchArchive"]) await execute(`DELETE FROM ${table}`);
});

test("status releases only its player while the cron completion guard can release all", async () => {
  const second = "30000000-0000-4000-8000-000000000001";
  await rememberMatch(rawMatch(1));
  for (const puuid of [selfId, second]) {
    await enqueueAudit({ puuid, name: "Player", tag: "TAG", region: "ap", rows: [stored(1)] });
  }
  await execute("UPDATE AuditHistory SET active = 1");
  const active = async (puuid: string) =>
    (await queryOne<{ active: number }>("SELECT active FROM AuditHistory WHERE puuid = ?", [puuid]))?.active;
  assert.equal((await auditCoverage(selfId)).state, "complete");
  assert.equal(await active(selfId), 0);
  assert.equal(await active(second), 1);
  await releaseCompletedAudits();
  assert.equal(await active(second), 0);
});

test("cached rosters cannot prematurely release an interrupted manifest", async () => {
  await rememberMatch(rawMatch(1));
  await execute(`INSERT INTO AuditHistory(puuid, riotName, riotTag, region, rowsJson, syncedAt)
    VALUES (?, 'Player', 'TAG', 'ap', ?, 123)`, [selfId, JSON.stringify([stored(1)])]);
  assert.equal((await auditCoverage(selfId)).cached, 1);
  await releaseCompletedAudits();
  assert.equal((await queryOne<{ active: number }>("SELECT active FROM AuditHistory"))?.active, 1);
});
