import test from "node:test";
import assert from "node:assert/strict";
import { incrementalProfileHistory } from "../src/lib/profile-history.ts";
import { HenrikDevError } from "../src/lib/henrik-errors.ts";
import type { HDStoredMatch } from "../src/lib/henrik-model.ts";
import { matchId, selfId } from "./history-fixtures.ts";

function row(i: number): HDStoredMatch {
  return { meta: { id: matchId(i), started_at: new Date(1_790_000_000_000 + i * 1000).toISOString() },
    stats: { puuid: selfId } } as HDStoredMatch;
}
test("bootstrap reads the full self list once and deduplicates match IDs", async () => {
  const calls: unknown[] = [];
  const rows = await incrementalProfileHistory(async (...args) => {
    calls.push(args); return [row(1), row(2), row(1)];
  }, "ap", selfId, "competitive", []);
  assert.deepEqual(calls, [["ap", selfId, { mode: "competitive" }]]);
  assert.deepEqual(rows.map((r) => r.meta.id), [matchId(2), matchId(1)]);
});
test("warm history checks only latest50 and retains all old statistics, including provider-removed games", async () => {
  const old = Array.from({ length: 703 }, (_, i) => row(i + 1));
  const calls: unknown[] = [];
  const updated = await incrementalProfileHistory(async (...args) => {
    calls.push(args); return [row(706), row(705), row(704), row(703)];
  }, "ap", selfId, undefined, old);
  assert.deepEqual(calls, [["ap", selfId, { size: 50, page: 1 }]]);
  assert.equal(updated.length, 706);
  assert.equal(updated[0].meta.id, matchId(706));
  assert.equal(old.length, 703);
});
test("loss of overlap repairs the gap with one full-list request rather than repeated paging", async () => {
  const calls: unknown[] = [];
  const result = await incrementalProfileHistory(async (...args) => {
    calls.push(args);
    return calls.length === 1 ? Array.from({ length: 50 }, (_, i) => row(i + 100)) : [row(101), row(1)];
  }, "ap", selfId, "unrated", [row(1)]);
  assert.deepEqual(calls, [["ap", selfId, { mode: "unrated", size: 50, page: 1 }],
    ["ap", selfId, { mode: "unrated" }]]);
  assert.equal(result.length, 51, "the repair must retain new rows already observed on page1");
});
test("empty or404 history cannot erase retained matches;429 and permissions remain errors", async () => {
  const previous = [row(1)];
  assert.deepEqual(await incrementalProfileHistory(async () => [], "ap", selfId, undefined, previous), previous);
  assert.deepEqual(await incrementalProfileHistory(async () => { throw new HenrikDevError(404, "missing"); },
    "ap", selfId, undefined, previous), previous);
  for (const code of [403, 429, 503]) {
    await assert.rejects(incrementalProfileHistory(async () => { throw new HenrikDevError(code, "failure"); },
      "ap", selfId, undefined, previous), (e: unknown) => e instanceof HenrikDevError && e.status === code);
  }
});
test("wrong-player or malformed stored rows never enter a merged profile", async () => {
  for (const response of [null, [{ ...row(1), stats: { puuid: "another-player" } }], [{ stats: {} }]]) {
    await assert.rejects(incrementalProfileHistory(async () => response as HDStoredMatch[],
      "ap", selfId, undefined, [row(1)]));
  }
});
