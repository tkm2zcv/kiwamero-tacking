import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { normalizeHDMatch } from "../src/lib/match-normalize.ts";
import { stored, rawMatch, selfId } from "./history-fixtures.ts";

const profile = {
  puuid: selfId, name: "Player", tag: "TAG", level: 100,
  region: "ap", currentTier: 12, currentRank: "Gold 1",
};

// Recorded from 951c4ae before restructuring; change only for intentional report-contract changes.
const cases = [
  { name: "empty", count: 0, shift: false, locale: "en",
    hash: "5b563ca1a1eee8f302fb86a2f2d5bd6ec89e668b850b2384d4c6487cd80ddc2a" },
  { name: "stable", count: 80, shift: false, locale: "ja",
    hash: "290e4de7f4983e6753c954123566bd89ff53882fd46a522b14e28c44ac7d96b0" },
  { name: "middle-change", count: 120, shift: true, locale: "en",
    hash: "e6c40a35cee851f61d9ed11cc6377c5dfcbca253c42d95728334f29927699402" },
] as const;

for (const scenario of cases) test(`full ${scenario.name} report retains its pre-refactor output`, () => {
  const rows = Array.from({ length: scenario.count }, (_, i) => stored(i,
    scenario.shift && i >= 40 && i < 80
      ? { kills: 30, deaths: 10, score: 9000, head: 20, body: 4, leg: 0 } : {}));
  const rosters = Array.from({ length: scenario.count ? 12 : 0 }, (_, i) => normalizeHDMatch(rawMatch(i)));
  const report = buildAccountReport({
    profile, seasons: [], storedAll: rows, rosterMatches: rosters, auditRosters: rosters,
    locale: scenario.locale, generatedAt: "2026-10-30T00:00:00Z",
  });
  assert.equal(createHash("sha256").update(JSON.stringify(report)).digest("hex"), scenario.hash);
});
