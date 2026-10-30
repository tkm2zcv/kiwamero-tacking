import test from "node:test";
import assert from "node:assert/strict";
import { summarizeAuditCoverage, type AuditCoveragePeriod } from "../src/lib/audit-coverage.ts";
import { archivePayload } from "../src/lib/match-archive-payload.ts";
import { archivePayload as legacyPayload, MATCH_ID as legacyId } from "../src/lib/match-archive.ts";
import { MATCH_ID } from "../src/lib/henrik-model.ts";
import { sampleMatches } from "../src/lib/report-scope.ts";
import { sampleMatches as legacySample } from "../src/lib/lobby-analysis.ts";
import { rawMatch, matchId } from "./history-fixtures.ts";

const period = (total: number, cached: number, unavailable = 0, next: number | null = null): AuditCoveragePeriod =>
  ({ period: "e11a6", from: 100, to: 200, total, cached, unavailable, next });

test("unstarted coverage stays idle with unknown history", () => {
  assert.deepEqual(summarizeAuditCoverage([]), {
    total: 0, cached: 0, pending: 0, unavailable: 0, syncedAt: 0,
    nextAttemptAt: null, periods: [], state: "idle",
  });
});

test("an explicitly empty manifest is complete rather than unstarted", () => {
  assert.equal(summarizeAuditCoverage([], { expected: 0, syncedAt: 123 }).state, "complete");
});

test("coverage preserves unmaterialized rows, earliest retry and immutable period input", () => {
  const periods = [period(4, 1, 1, 120), period(2, 0, 0, 0)];
  const original = structuredClone(periods);
  const result = summarizeAuditCoverage(periods, { expected: 10, syncedAt: 123 });
  assert.deepEqual(result, {
    total: 10, cached: 1, pending: 8, unavailable: 1, syncedAt: 123,
    nextAttemptAt: 0, periods, state: "pending",
  });
  assert.deepEqual(periods, original);
});

test("terminal failures produce partial coverage, not fictitious completion", () => {
  const result = summarizeAuditCoverage([period(3, 2, 1), period(3, 2, 1)], { expected: 6, syncedAt: 123 });
  assert.equal(result.state, "partial");
  assert.equal(result.cached, 4); assert.equal(result.unavailable, 2);
  assert.equal(result.pending, 0); assert.equal(result.nextAttemptAt, null);
});

test("fully archived periods retain counts even if the manifest expectation is lower", () => {
  const result = summarizeAuditCoverage([period(3, 3), period(3, 3)], { expected: 4, syncedAt: 123 });
  assert.equal(result.state, "complete");
  assert.equal(result.total, 6); assert.equal(result.cached, 6);
  assert.equal(result.syncedAt, 123);
});

test("archive projection is identical for flat/v3 rosters and omits event blobs", () => {
  const raw = rawMatch(1);
  const people = Array.isArray(raw.players) ? raw.players : raw.players.all_players;
  raw.rounds = [{ largeEvent: "not retained" }];
  people[0].economy = { notRetained: true };
  const original = structuredClone(raw);
  const payload = archivePayload(raw);
  assert.equal(archivePayload({ ...raw, players: { all_players: people } }), payload);
  const stored = JSON.parse(payload);
  assert.equal(stored.players.length, 10);
  assert.ok(!("rounds" in stored)); assert.ok(!("economy" in stored.players[0]));
  assert.equal(stored.players[0].party_id, people[0].party_id);
  assert.deepEqual(raw, original);
});

test("archive projection preserves missing-stat and identity refusals while accepting observed zero", () => {
  const raw = rawMatch(1);
  const people = Array.isArray(raw.players) ? raw.players : raw.players.all_players;
  people[0].stats.score = undefined as unknown as number;
  assert.throws(() => archivePayload(raw), { status: 502, message: "Missing match statistics" });
  people[0].stats.score = 0;
  assert.doesNotThrow(() => archivePayload(raw));
  assert.throws(() => archivePayload(raw, matchId(2)), { status: 502, message: "Incomplete match detail" });
});

test("legacy pure exports remain compatible after moving their implementations", () => {
  assert.equal(legacyPayload, archivePayload);
  assert.equal(legacyId, MATCH_ID);
  assert.equal(legacySample, sampleMatches);
});
