import test from "node:test";
import assert from "node:assert/strict";
import { encounterCoverageText, type EncounterCoverage } from "../src/lib/encounter-coverage.ts";

const sample: EncounterCoverage = {
  covered: 48, total: 54, allActs: true, recentTotal: 50, recentCovered: 48,
  pending: 2, olderMissing: 4, unavailable: 0, blocked: false, loaded: true,
};
test("Japanese encounter coverage explains real counts, recent-only acquisition and partial data", () => {
  const copy = encounterCoverageText("ja", sample);
  for (const text of ["54試合中", "48試合", "全期間", "直近50試合", "残り2試合", "過去の未保存4試合", "遭遇なし"]) {
    assert.ok(copy.includes(text), text);
  }
  assert.doesNotMatch(copy, /[A-Za-z]|最新2|2ACT/);
});
test("failed archive reads never display misleading zero coverage", () => {
  const copy = encounterCoverageText("ja", { ...sample, loaded: false });
  assert.match(copy, /読み込めませんでした/);
  assert.doesNotMatch(copy, /54試合|48試合/);
});
test("unavailable and blocked states stay distinct from pending work", () => {
  const copy = encounterCoverageText("ja", { ...sample, blocked: true, unavailable: 1, allActs: false });
  assert.match(copy, /一時停止/);
  assert.match(copy, /取得できない試合：1試合/);
  assert.doesNotMatch(copy, /全期間|バックグラウンドで取得/);
});
test("complete data omits pending warnings and English remains explicitly available", () => {
  const c = { ...sample, pending: 0, olderMissing: 0, covered: 54 };
  assert.doesNotMatch(encounterCoverageText("ja", c), /残り|対象外/);
  assert.match(encounterCoverageText("en", c), /54 of 54 matches/);
});
