import test from "node:test";
import assert from "node:assert/strict";
import { auditTimeline, validAuditRows } from "../src/lib/audit-timeline.ts";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { normalizeHDMatch } from "../src/lib/match-normalize.ts";
import { rawMatch, selfId, stored } from "./history-fixtures.ts";

test("a short middle-period change survives identical oldest/newest period averages", () => {
  const rows = Array.from({ length: 160 }, (_, i) => stored(i, i >= 60 && i < 100 ? {
    kills: 30, deaths: 10, score: 9000, head: 20, body: 4, leg: 0,
    agent: "Omen", cluster: "Singapore",
  } : {}));
  const timeline = auditTimeline(validAuditRows(rows));
  assert.equal(timeline.windowsScanned, 121);
  assert.equal(timeline.comparableWindows, 121);
  assert.ok(timeline.candidates.length >= 2);
  assert.ok(timeline.candidates.some((c) => c.at === rows[60].startedAt));
  assert.ok(timeline.candidates.some((c) => c.at === rows[100].startedAt));
  assert.ok(timeline.candidates.some((c) => c.server.changed));
  const report = buildAccountReport({
    profile: { name: "Player", tag: "TAG", puuid: selfId, level: 100, region: "ap", currentRank: "Gold 1", currentTier: 12 },
    seasons: [], storedAll: rows, rosterMatches: [], locale: "en", generatedAt: "2026-10-30T00:00:00Z",
  });
  assert.ok(report.audit.breakdown.performanceScore >= 25);
  assert.equal(report.comparison.before.count, 20);
});

test("rank-environment, missing-shots and insufficient-window periods remain unexamined", () => {
  const rows = Array.from({ length: 40 }, (_, i) => stored(i, i < 20 ? {} : {
    tier: 25, kills: 40, deaths: 10, score: 12000, head: 22, body: 2,
  }));
  assert.equal(auditTimeline(rows).comparableWindows, 0);
  assert.equal(auditTimeline(rows).candidates.length, 0);
  assert.equal(auditTimeline(rows.slice(0, 39)).windowsScanned, 0);
  const incomplete = rows.map((r) => ({ ...r, tier: 12, accuracyAvailable: false }));
  assert.equal(auditTimeline(incomplete).comparableWindows, 0);
});

test("server choice, time of day and renames alone never create a change candidate", () => {
  const rows = Array.from({ length: 60 }, (_, i) => stored(i, {
    cluster: i < 30 ? "Tokyo" : "Singapore", selfName: i < 30 ? "Old" : "New",
    startedAt: stored(i).startedAt + (i < 30 ? 0 : 12 * 3600),
  }));
  assert.equal(auditTimeline(validAuditRows(rows)).candidates.length, 0);
});

test("party evidence is unavailable without enough known rosters and repeating partners", () => {
  const rows = Array.from({ length: 40 }, (_, i) => stored(i, i < 20 ? {} : {
    kills: 30, deaths: 10, score: 9000, head: 20, body: 4, leg: 0,
  }));
  assert.equal(auditTimeline(rows).candidates[0].partyOverlap, null);
  const rosters = rows.map((_, i) => normalizeHDMatch(rawMatch(i)));
  const candidate = auditTimeline(rows, rosters, selfId).candidates[0];
  assert.equal(candidate.rosterBefore, 20);
  assert.equal(candidate.rosterAfter, 20);
  assert.equal(candidate.partyOverlap, 1);
  assert.equal(auditTimeline(rows, rosters.slice(0, 10), selfId).candidates[0].partyOverlap, null);
});

test("future, noncompetitive and duplicate history is excluded before scanning", () => {
  const rows = [stored(1), stored(1), stored(2, { mode: "Unrated" }),
    stored(3, { startedAt: Date.now() / 1000 + 86400 })];
  assert.equal(validAuditRows(rows).length, 1);
});
