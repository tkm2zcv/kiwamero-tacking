import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { stored, selfId } from "./history-fixtures.ts";
import type { StoredRow } from "../src/lib/stored-stats";

const profile = {
  puuid: selfId, name: "Player", tag: "TAG", level: 500,
  region: "ap", currentTier: 12, currentRank: "Gold 1",
};
const report = (rows: StoredRow[], extra: Partial<Parameters<typeof buildAccountReport>[0]> = {}) =>
  buildAccountReport({ profile, seasons: [], storedAll: rows, rosterMatches: [],
    locale: "en", generatedAt: "2026-10-30T00:00:00Z", ...extra });
const decline = (count = 80, boundary = 40) => Array.from({ length: count }, (_, i) =>
  stored(i, { tier: i < boundary ? 26 : 12, kills: i < boundary ? 18 : 9, deaths: 15 }));

test("observed Immortal-to-Gold persistent low KD is primary evidence without ACS/HS changes", () => {
  const r = report(decline());
  assert.equal(r.audit.breakdown.performanceScore, 55);
  assert.equal(r.audit.breakdown.rankScore, 20);
  assert.equal(r.audit.score, 75);
  assert.equal(r.audit.grade, "S");
  assert.equal(r.audit.boundary?.persistentLowKd, true);
  assert.equal(r.audit.boundary?.at, stored(40).startedAt);
  assert.equal(r.comparison.comparable, true);
  assert.equal(r.comparison.acsDiff, 0);
  assert.equal(r.comparison.hsDiff, 0);
});

test("missing shots do not veto a measured KD discontinuity", () => {
  const r = report(decline().map((row) => ({ ...row, accuracyAvailable: false })));
  assert.equal(r.audit.score, 75);
  assert.equal(r.comparison.before.accuracyCount, 0);
  assert.equal(r.audit.boundary?.persistentLowKd, true);
});

test("a historical peak without observed prior high-rank performance adds no rank evidence", () => {
  const rows = decline().map((row) => ({ ...row, tier: 12 }));
  const extra = { seasons: [{ episode: "e10", act: "a1", actCode: "e10a1",
    peakTier: 26, peakRank: "Immortal 3", rankIcon: "", games: 50, wins: 30 }] };
  assert.equal(report(rows, extra).audit.breakdown.rankScore, 0);
  assert.equal(report(rows, extra).audit.score, report(rows).audit.score);
});

test("rank drop with strong KD or always-low KD is not a player-change discontinuity", () => {
  const strong = decline().map((row, i) => ({ ...row, kills: i < 40 ? 18 : 27 }));
  const alwaysLow = decline().map((row) => ({ ...row, kills: 9 }));
  assert.equal(report(strong).audit.score, 0);
  assert.equal(report(alwaysLow).audit.score, 0);
});

test("gradual improvement and gradual decline cannot fall back to a scored half-history delta", () => {
  for (const direction of [-1, 1]) {
    const rows = Array.from({ length: 80 }, (_, i) =>
      stored(i, { kills: direction === 1 ? 8 + i : 90 - i, deaths: 30 }));
    const r = report(rows);
    assert.equal(r.audit.score, 0);
    assert.equal(r.audit.boundary, null);
  }
});

test("a few extreme bad games and a ten-game slump followed by recovery are not persistent", () => {
  for (const badCount of [3, 10]) {
    const rows = Array.from({ length: 80 }, (_, i) => stored(i,
      i >= 40 && i < 40 + badCount ? { kills: 0, deaths: 200 } : { kills: 18, deaths: 15 }));
    assert.equal(report(rows).audit.breakdown.performanceScore, 0);
  }
});

test("server migration alone is small and selected-country metadata never changes points", () => {
  const rows = Array.from({ length: 80 }, (_, i) => stored(i,
    { cluster: i < 40 ? "Singapore" : "Tokyo" }));
  const r = report(rows);
  assert.equal(r.audit.breakdown.serverScore, 10);
  assert.equal(r.audit.score, 10);
  assert.equal(r.audit.grade, "C");
  const mismatch = report(rows, { auditCountry: "Vnm" });
  assert.equal(mismatch.audit.originMismatch, true);
  assert.equal(mismatch.audit.score, r.audit.score);
});

test("only a server switch at the KD boundary reinforces the same event", () => {
  const together = decline().map((row, i) => ({ ...row, cluster: i < 40 ? "Singapore" : "Tokyo" }));
  assert.equal(report(together).audit.breakdown.serverScore, 20);
  const apart = decline(160, 120).map((row, i) =>
    ({ ...row, cluster: i < 40 ? "Singapore" : "Tokyo" }));
  const r = report(apart);
  assert.equal(r.audit.boundary?.at, stored(120).startedAt);
  assert.equal(r.audit.breakdown.serverScore, 0);
  assert.equal(r.audit.score, report(decline(160, 120)).audit.score);
});

test("a middle-history server switch is visible even when lifetime endpoints match", () => {
  const rows = decline(120).map((row, i) =>
    ({ ...row, cluster: i >= 40 && i < 80 ? "Singapore" : "Tokyo" }));
  const r = report(rows);
  assert.equal(r.lifetimeGenealogy.hasClusterFlip, false);
  assert.equal(r.audit.breakdown.serverScore, 20);
  assert.equal(r.audit.boundary?.server.changed, true);
});

test("missing clusters and Tokyo shard aliases do not create migration evidence", () => {
  for (const cluster of ["", "Tokyo 1"]) {
    const r = report(decline().map((row, i) => ({ ...row, cluster: i < 40 ? cluster : "Tokyo" })));
    assert.equal(r.audit.breakdown.serverScore, 0);
  }
});

test("role changes and long breaks weaken an otherwise identical KD event", () => {
  const rows = decline();
  const baseline = report(rows);
  const role = report(rows.map((row, i) => ({ ...row, agent: i < 40 ? "Jett" : "Sage" })));
  assert.ok(role.audit.score! < baseline.audit.score!);
  assert.ok(role.audit.signals.some((s) => s.category === "role"));
  const gap = report(rows.map((row, i) =>
    ({ ...row, startedAt: row.startedAt + (i < 40 ? 0 : 35 * 86400) })));
  assert.ok(gap.audit.score! < baseline.audit.score!);
  assert.ok(gap.audit.signals.some((s) => s.category === "gap"));
});

test("missing ranks and wholly deathless samples are unassessable, not normal C", () => {
  for (const rows of [
    decline().map((row) => ({ ...row, tier: 0 })),
    decline().map((row) => ({ ...row, deaths: 0 })),
  ]) {
    const r = report(rows);
    assert.equal(r.audit.score, null);
    assert.equal(r.audit.grade, null);
    assert.equal(r.audit.status, "unassessable");
    assert.equal(JSON.stringify(r).includes("NaN"), false);
  }
});

test("a harder-rank window is not scored as unexplained decline; sparse history stays insufficient", () => {
  const rows = Array.from({ length: 40 }, (_, i) =>
    stored(i, { tier: i < 20 ? 12 : 26, kills: i < 20 ? 18 : 9, deaths: 15 }));
  assert.equal(report(rows).audit.score, null);
  assert.equal(report(rows.slice(0, 39)).audit.status, "insufficient");
});

test("zero-death games cannot poison an otherwise complete sample", () => {
  const rows = decline();
  rows[0] = { ...rows[0], deaths: 0 };
  const r = report(rows);
  assert.ok(r.audit.score !== null);
  assert.ok(Number.isFinite(r.audit.score));
});

test("KD-only strengthening is input-order and duplicate invariant", () => {
  const rows = decline();
  assert.deepEqual(report([...rows].reverse()).audit, report(rows).audit);
  assert.deepEqual(report([...rows, ...rows]).audit, report(rows).audit);
});

test("a nearby same-rank boundary cannot evade a long-recording-gap penalty", () => {
  const rows = decline().map((row) => ({ ...row, tier: 12 }));
  const r = report(rows.map((row, i) =>
    ({ ...row, startedAt: row.startedAt + (i < 40 ? 0 : 35 * 86400) })));
  assert.ok(r.audit.score! < report(rows).audit.score!);
  assert.ok(r.audit.boundary!.gapDays >= 30);
});
