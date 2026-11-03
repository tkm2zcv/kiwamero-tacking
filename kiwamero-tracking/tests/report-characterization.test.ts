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

// Audit snapshots intentionally updated for persistent-K/D boundaries.
// Verdict hashes were captured before this change and must remain unchanged.
const cases = [
  { name: "empty", count: 0, shift: false, locale: "en",
    hash: "663f61fc704b492968788f28bf4d1fef0918aa1cd93a77e8bf0212df409c902d",
    verdictHash: "f78b6e6148085c43cc08e7aa2f71a597b30c20c994d2a5e8ff90dfccbfd0cf5e" },
  { name: "stable", count: 80, shift: false, locale: "ja",
    hash: "65979a4cb29296c0ba3e625b2e091af3e8e758c381e33dbdfdb28e1883a188a5",
    verdictHash: "c402a7d4ac57d0983f9e558c4daf057166f19bffd2b149504c2f072b7fbc2896" },
  { name: "middle-change", count: 120, shift: true, locale: "en",
    hash: "93bfc4cc13c9b309971c707abc5757960db66d44641e56ec14968c02ce710896",
    verdictHash: "ad26e05b86988333b277171405d218a9204c0a20dc9dec63f4f7f19b15f8bb74" },
] as const;

for (const scenario of cases) test(`full ${scenario.name} report retains its audited contract and original smurf verdict`, () => {
  const rows = Array.from({ length: scenario.count }, (_, i) => stored(i,
    scenario.shift && i >= 40 && i < 80
      ? { kills: 30, deaths: 10, score: 9000, head: 20, body: 4, leg: 0 } : {}));
  const rosters = Array.from({ length: scenario.count ? 12 : 0 }, (_, i) => normalizeHDMatch(rawMatch(i)));
  const report = buildAccountReport({
    profile, seasons: [], storedAll: rows, rosterMatches: rosters, auditRosters: rosters,
    locale: scenario.locale, generatedAt: "2026-10-30T00:00:00Z",
  });
  assert.equal(createHash("sha256").update(JSON.stringify(report)).digest("hex"), scenario.hash);
  assert.equal(createHash("sha256").update(JSON.stringify(report.verdict)).digest("hex"), scenario.verdictHash);
});
