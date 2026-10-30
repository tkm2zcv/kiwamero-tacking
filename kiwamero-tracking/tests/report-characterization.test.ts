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
    hash: "01fe32071d272ff66e1245db3c56e28863bd97f52ce7e976355e8d0d94831f36" },
  { name: "stable", count: 80, shift: false, locale: "ja",
    hash: "5e5cf0dd149bdcae57bdb9256beaf01849633af4e884ad780e7b6948e035478c" },
  { name: "middle-change", count: 120, shift: true, locale: "en",
    hash: "b0356a902480050efe0063b8624474700c6a4a1c7806efee522c75c016a0fe8a" },
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
