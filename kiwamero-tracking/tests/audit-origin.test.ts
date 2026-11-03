import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { stored, selfId } from "./history-fixtures.ts";
import type { StoredRow } from "../src/lib/stored-stats";

const profile = { puuid: selfId, name: "Player", tag: "TAG", level: 300,
  region: "ap", currentTier: 12, currentRank: "Gold 1" };
const rows = (count = 100, shiftedAt = 40) => Array.from({ length: count }, (_, i) =>
  stored(i, { startedAt: Date.parse("2026-06-01") / 1000 + i * 43200,
    cluster: i < shiftedAt ? "Singapore" : "Tokyo" }));
const report = (storedAll: StoredRow[], auditCountry?: string) => buildAccountReport({
  profile, storedAll, seasons: [], rosterMatches: [], locale: "ja",
  generatedAt: "2026-10-30T00:00:00Z", auditCountry,
});

test("stable initial-to-recent server evidence adds30 once, without requiring a KD change", () => {
  const r = report(rows());
  assert.equal(r.audit.score, 30);
  assert.equal(r.audit.grade, "B");
  assert.equal(r.audit.breakdown.serverScore, 30);
  assert.equal(r.audit.breakdown.performanceScore, 0);
  assert.equal(r.audit.originScored, true);
  assert.equal(r.audit.originShift?.from, "Singapore");
  assert.equal(r.audit.originShift?.to, "Tokyo");
  assert.equal(r.audit.originShift?.recentMatches, 40);
  assert.match(r.audit.signals.find((s) => s.title.includes("初期と直近"))!.description, /二重|重複/);
});
test("gradual moves score stable origin evidence even when no local abrupt boundary exists", () => {
  const gradual = rows(140).map((r, i) => ({ ...r,
    cluster: i < 20 ? "Singapore" : i < 100 ? i % 2 ? "Singapore" : "Tokyo" : "Tokyo" }));
  const r = report(gradual);
  assert.equal(r.auditTimeline.candidates.length, 0);
  assert.equal(r.audit.boundary, null);
  assert.equal(r.audit.originScored, true);
  assert.equal(r.audit.score, 30);
});
test("aligned low-KD/server changes use max30, never30+20, and score remains capped100", () => {
  const r = report(rows(80).map((r, i) => ({ ...r, tier: i < 40 ? 26 : 12,
    kills: i < 40 ? 18 : 9, deaths: 15 })));
  assert.equal(r.audit.breakdown.serverScore, 30);
  assert.equal(r.audit.breakdown.performanceScore, 55);
  assert.equal(r.audit.breakdown.rankScore, 20);
  assert.equal(r.audit.originScored, true);
  assert.equal(r.audit.score, 100);
});
test("origin change and a later KD event are not added across unrelated dates", () => {
  const r = report(rows(160).map((r, i) => ({ ...r, tier: i < 120 ? 26 : 12,
    kills: i < 120 ? 18 : 9, deaths: 15 })));
  assert.ok(r.audit.originShift);
  assert.equal(r.audit.originScored, false);
  assert.equal(r.audit.breakdown.serverScore, 0);
  assert.equal(r.audit.score, 75);
});
test("a30-day recording gap halves stable origin points, including gradual moves", () => {
  const r = report(rows().map((r, i) => ({ ...r, startedAt: r.startedAt + (i < 40 ? 0 : 35 * 86400) })));
  assert.equal(r.audit.originShift?.points, 15);
  assert.equal(r.audit.breakdown.serverScore, 15);
  assert.equal(r.audit.score, 15);
});
test("short visits, fewer than60 matches, unknown origins and equivalent shards never add origin points", () => {
  const cases = [
    rows(59), rows(100, 80), rows(100).map((r, i) => ({ ...r, cluster: i < 20 ? "" : "Tokyo" })),
    rows(100).map((r, i) => ({ ...r, cluster: i < 40 ? "Tokyo 1" : "Tokyo" })),
    rows(100).map((r, i) => ({ ...r, cluster: i < 20 ? "Unknown" : "Tokyo" })),
    rows(100).map((r, i) => ({ ...r, cluster: i < 40 ? "Tokyo 1 " : "Tokyo" })),
    rows(80).map((r, i) => ({ ...r, startedAt: Date.parse("2026-06-01") / 1000 + i * 3600 })),
  ];
  for (const sample of cases) assert.equal(report(sample).audit.originShift, undefined);
});
test("each recent20 half independently needs80% dominance, not merely32/40 aggregate", () => {
  const sample = rows(100);
  for (let i = 60; i < 68; i++) sample[i].cluster = "Singapore";
  assert.equal(report(sample).audit.originShift, undefined);
});
test("origin evidence does not bypass insufficient rank/KD assessment or country safeguards", () => {
  const r = report(rows().map((r) => ({ ...r, tier: 0 })));
  assert.ok(r.audit.originShift);
  assert.equal(r.audit.score, null);
  assert.equal(r.audit.originScored, false);
  assert.equal(r.audit.status, "unassessable");
  assert.equal(report(rows(), "Vnm").audit.score, report(rows()).audit.score);
});
test("input ordering and duplicate IDs cannot inflate the origin contribution", () => {
  assert.deepEqual(report([...rows()].reverse()).audit, report(rows()).audit);
  assert.deepEqual(report([...rows(), ...rows()]).audit, report(rows()).audit);
});
