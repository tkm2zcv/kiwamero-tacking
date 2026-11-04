import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { stored, selfId } from "./history-fixtures.ts";
import type { StoredRow } from "../src/lib/stored-stats";
import type { SeasonRank } from "../src/lib/types";

const profile = { puuid: selfId, name: "Fixture", tag: "TAG", level: 300,
  region: "ap", currentTier: 9, currentRank: "Silver 1" };
const make = () => Array.from({ length: 80 }, (_, i) => stored(i, {
  tier: i < 40 ? 24 : 10, kills: i < 40 ? 20 : 17, deaths: 18,
  startedAt: Date.parse(i < 40 ? "2023-10-01" : "2026-10-23") / 1000 + (i % 40) * 8640,
  seasonShort: i < 40 ? "e7a3" : "e11a6",
}));
const report = (storedAll: StoredRow[], seasons: SeasonRank[] = []) => buildAccountReport({
  profile, storedAll, seasons, rosterMatches: [], locale: "ja", generatedAt: "2026-10-30T00:00:00Z",
});
const act = (over: Partial<SeasonRank> = {}): SeasonRank => ({
  episode: "e7", act: "a3", actCode: "e7a3", peakTier: 24, peakRank: "Immortal 1",
  rankIcon: "", games: 126, wins: 73, ...over,
});

test("former Immortal struggling in Silver scores without a sharp KD drop or ACS/HS changes", () => {
  const r = report(make());
  assert.equal(r.audit.capabilityScored, true);
  assert.equal(r.audit.capability?.source, "observed");
  assert.equal(r.audit.score, 55);
  assert.equal(r.audit.grade, "A");
  assert.equal(r.audit.boundary, null);
});
test("historical ACT proof plus current same-window server change forms one85-point assessment", () => {
  const sample = make().map((r, i) => ({ ...r, tier: i < 40 ? 18 : 10,
    cluster: i < 40 ? "Hong Kong" : "Tokyo" }));
  const r = report(sample, [act()]);
  assert.equal(r.audit.capability?.source, "act");
  assert.equal(r.audit.capability?.priorGames, 126);
  assert.equal(r.audit.capability?.priorTier, 24);
  assert.equal(r.audit.originScored, true);
  assert.equal(r.audit.score, 85);
  assert.equal(r.audit.grade, "S");
  assert.equal(r.audit.boundary, null);
  assert.deepEqual(r.audit.breakdown, { rankScore: 20, serverScore: 30, performanceScore: 35, activityScore: 0 });
});
test("current40 games need not span7 days; historical gaps do not erase observed endpoint differences", () => {
  const r = report(make().map((r, i) => ({ ...r, cluster: i < 40 ? "Hong Kong" : "Tokyo" })));
  assert.ok(r.audit.originShift!.recentTo - r.audit.originShift!.recentFrom < 7 * 86400);
  assert.ok(r.audit.capability!.gapDays > 30);
  assert.equal(r.audit.score, 85);
});
test("pronounced low KD strengthens the capability signal and sums never exceed100", () => {
  const r = report(make().map((r, i) => ({ ...r, kills: i < 40 ? 20 : 10,
    cluster: i < 40 ? "Singapore" : "Tokyo" })));
  assert.equal(r.audit.breakdown.performanceScore, 55);
  assert.equal(r.audit.score, 100);
});
test("strong recent KD, temporary slumps, absent historical proof and invalid ACTs do not add capability points", () => {
  assert.equal(report(make().map((r, i) => ({ ...r, kills: i < 40 ? 20 : 30 }))).audit.capability, undefined);
  assert.equal(report(make().map((r, i) => ({ ...r, kills: i < 60 ? 20 : 10 }))).audit.capability, undefined);
  const noProof = make().map((r, i) => ({ ...r, tier: i < 40 ? 18 : 10 }));
  for (const records of [[], [act({ games: 1 })], [act({ actCode: "e12a1" })],
    [act({ actCode: "e1a1" })], [act({ peakTier: 28 })], [act({ wins: 200 })]]) {
    assert.equal(report(noProof, records).audit.capability, undefined);
  }
});
test("unknown recent ranks and a few extreme-death outliers cannot establish sustained struggle", () => {
  assert.equal(report(make().map((r, i) => ({ ...r, tier: i < 40 ? 24 : 0 }))).audit.capability, undefined);
  assert.equal(report(make().map((r, i) => ({ ...r, kills: 30, deaths: [45, 65].includes(i) ? 999 : 15 }))).audit.capability, undefined);
});
test("country metadata, input order and duplicates do not affect longitudinal points or diagnosis", () => {
  const r = report(make());
  assert.deepEqual(report([...make()].reverse()).audit, r.audit);
  assert.deepEqual(report([...make(), ...make()]).audit, r.audit);
  assert.deepEqual(r.verdict, report(make(), [act()]).verdict);
  const country = buildAccountReport({ profile, storedAll: make(), seasons: [], rosterMatches: [],
    locale: "ja", generatedAt: "2026-10-30T00:00:00Z", auditCountry: "Vnm" });
  assert.equal(country.audit.score, r.audit.score);
});
test("fewer than10 observed high-rank games do not establish a historical reference", () => {
  const r = report(make().map((r, i) => ({ ...r, tier: i < 9 ? 24 : i < 40 ? 18 : 10 })));
  assert.equal(r.audit.capability, undefined);
});
test("ACT peak without current underperformance or with missing counts is not scored", () => {
  const sample = make().map((r, i) => ({ ...r, tier: i < 40 ? 18 : 10, kills: 30 }));
  assert.equal(report(sample, [act()]).audit.capability, undefined);
  const noObserved = make().map((r, i) => ({ ...r, tier: i < 40 ? 18 : 10 }));
  assert.equal(report(noObserved, [act({ games: undefined })]).audit.capability, undefined);
  assert.equal(report(noObserved, [act({ wins: undefined })]).audit.capability, undefined);
});
