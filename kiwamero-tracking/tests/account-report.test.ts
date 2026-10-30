import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountReport } from "../src/lib/account-report.ts";
import { recentReportRosters, selectDiagnosisDetailIds, DIAGNOSIS_DETAIL_CAP } from "../src/lib/report-scope.ts";
import { agentRole } from "../src/lib/rank-benchmarks.ts";
import { normalizeStoredMatch, type StoredRow } from "../src/lib/stored-stats.ts";
import type { Match, MatchPlayer, SeasonRank } from "../src/lib/types.ts";

const DAY = 86400;
const T0 = Date.parse("2026-08-02T00:00:00Z") / 1000;

function row(over: Partial<StoredRow>): StoredRow {
  return {
    id: over.id ?? "default-match",
    map: "Ascent", mapId: "", mode: "Competitive",
    startedAt: T0, day: "", seasonId: "uuid", seasonShort: "e11a6",
    agent: "Jett", agentId: "", tier: 20,
    score: 5000, kills: 12, deaths: 12, assists: 4,
    head: 8, body: 14, leg: 2, dmgMade: 3000, dmgRecv: 2800,
    won: 13, lost: 11, rounds: 24, result: "win", cluster: "Tokyo",
    selfName: "Player", selfTag: "TAG", level: 500,
    ...over,
  };
}

/** `n` stored rows across `days`, all `cluster`, stat line `per`. */
function history(n: number, days: number, cluster: string | [string, string], per: Partial<StoredRow> = {}): StoredRow[] {
  const rows: StoredRow[] = [];
  for (let i = 0; i < n; i++) {
    const c = Array.isArray(cluster) ? (i < n / 2 ? cluster[0] : cluster[1]) : cluster;
    // Long histories end before generatedAt instead of extending into the future.
    rows.push(row({ id: `h${i}`, startedAt: T0 - Math.max(0, days - 80) * DAY + i * (days * DAY) / n, cluster: c, ...per }));
  }
  return rows;
}

function player(puuid: string, name: string, tag: string, team: string, tier: number, over: Partial<MatchPlayer["stats"]> = {}): MatchPlayer {
  return {
    puuid, name, tag, team_id: team, character: "Jett", currenttier: tier,
    stats: { score: 5200, kills: 13, deaths: 12, assists: 3, headshots: 7, bodyshots: 14, legshots: 3, ...over },
  } as MatchPlayer;
}

/** Full-roster competitive match: self + 9 others near `lobbyTier`, self uses `selfStats`. */
function compMatch(id: string, lobbyTier: number, selfStats: Partial<MatchPlayer["stats"]>, won: boolean): Match {
  const others: MatchPlayer[] = [];
  for (let i = 0; i < 9; i++) {
    others.push(player(`o${i}`, `Opp${i}`, "T", i < 4 ? "red" : "blue", Math.max(3, Math.min(27, lobbyTier + (i % 2 ? 1 : -1)))));
  }
  const self = player("self", "Player", "TAG", "red", lobbyTier, { kills: 13, deaths: 12, score: 5200, headshots: 7, bodyshots: 14, legshots: 3, ...selfStats });
  const players = [self, ...others];
  return {
    metadata: { matchid: id, mode_id: "competitive", mode: "Competitive", game_start: T0, rounds_played: 24 },
    teams: {
      red: { has_won: won, rounds_won: won ? 13 : 11, rounds_lost: won ? 11 : 13 },
      blue: { has_won: !won, rounds_won: won ? 11 : 13, rounds_lost: won ? 13 : 11 },
    },
    players,
  } as unknown as Match;
}

const seasons = (list: [string, number, string, number][]): SeasonRank[] =>
  list.map(([actCode, peakTier, peakRank, games]) => ({
    episode: actCode, act: actCode, actCode, peakRank, peakTier,
    rankIcon: "", wins: Math.round(games * 0.52), games,
  }));

const prof = (over: Partial<Parameters<typeof buildAccountReport>[0]["profile"]> = {}) => ({
  name: "Player", tag: "TAG", puuid: "self", level: 500, region: "ap",
  currentTier: 26, currentRank: "Immortal 3", ...over,
});

const report = (o: Partial<Parameters<typeof buildAccountReport>[0]>) =>
  buildAccountReport({
    profile: prof(), seasons: [], storedAll: [], rosterMatches: [],
    locale: "en", generatedAt: "2026-10-30T00:00:00Z", ...o,
  });

test("clean long history → audit ~0, grade C, NATURAL_PLAYER", () => {
  const stored = history(200, 400, "Tokyo", { tier: 26 });
  const roster = Array.from({ length: 10 }, (_, i) =>
    compMatch(`c${i}`, 26, {}, i % 2 === 0));
  const r = report({
    profile: prof({ level: 900 }),
    seasons: seasons([["e10a1", 21, "Ascendant 1", 150], ["e10a5", 24, "Immortal 1", 140], ["e11a6", 26, "Immortal 3", 60]]),
    storedAll: stored, rosterMatches: roster,
  });
  assert.ok(r.audit.score !== null && r.audit.score < 20, `score ${r.audit.score}`);
  assert.equal(r.audit.grade, "C");
  assert.equal(r.lifetimeGenealogy.isRenamed, false);
  assert.equal(r.verdict.verdict.type, "NATURAL_PLAYER");
  assert.ok(r.verdict.scores.smurfScore !== null && r.verdict.scores.smurfScore < 50);
});

test("low-level high-performer in easy lobbies → smurf verdict", () => {
  // Silver-tier account dominating: kd ~1.7, acs ~330, hs ~34% vs Silver means.
  const stored = history(120, 60, "Tokyo", {
    tier: 10, kills: 22, deaths: 13, score: 7800, head: 11, body: 18, leg: 3, result: "win",
  });
  const roster = Array.from({ length: 15 }, (_, i) =>
    compMatch(`s${i}`, 10, { kills: 24, deaths: 13, score: 7900, headshots: 12, bodyshots: 20, legshots: 3 }, true));
  const r = report({
    profile: prof({ level: 45, currentTier: 10, currentRank: "Silver 2" }),
    storedAll: stored, rosterMatches: roster,
  });
  assert.ok(r.verdict.scores.smurfScore !== null && r.verdict.scores.smurfScore >= 50, `smurf ${r.verdict.scores.smurfScore}`);
  assert.equal(r.verdict.verdict.type, "SMURF_SUSPECT");
  assert.ok(r.verdict.estimatedTrueRank);
  assert.ok(r.verdict.estimatedTrueRank.tier > 10);
  assert.ok(r.verdict.estimatedTrueRank.tierGap >= 2);
});

test("server choice change alone cannot imply ownership change", () => {
  const stored = history(100, 300, ["Singapore", "Tokyo"], { tier: 22 });
  const r = report({
    profile: prof({ level: 600, currentTier: 22 }),
    seasons: seasons([["e10a1", 20, "Diamond 3", 60], ["e11a6", 22, "Ascendant 2", 40]]),
    storedAll: stored,
    rosterMatches: Array.from({ length: 5 }, (_, i) => compMatch(`f${i}`, 22, {}, i % 2 === 0)),
  });
  assert.equal(r.lifetimeGenealogy.hasClusterFlip, true);
  assert.equal(r.lifetimeGenealogy.earliestCluster, "Singapore");
  assert.equal(r.audit.breakdown.serverScore, 0);
  assert.equal(r.audit.score, 0);
  assert.ok(r.audit.signals.some((s) => s.category === "server" && s.severity === "info"));
});

test("rename detected from earliest stored row", () => {
  const stored = history(60, 200, "Tokyo", { tier: 20 });
  stored[0] = row({ id: "old", startedAt: stored[0].startedAt - DAY, selfName: "Former", selfTag: "OLD" });
  const r = report({ profile: prof({ name: "Player", tag: "TAG" }), storedAll: stored });
  assert.equal(r.lifetimeGenealogy.isRenamed, true);
  assert.equal(r.lifetimeGenealogy.originalName, "Former#OLD");
  assert.equal(r.audit.breakdown.activityScore, 0);
});

test("insufficient data → INSUFFICIENT_DATA verdict", () => {
  const r = report({ storedAll: history(10, 20, "Tokyo"), rosterMatches: [] });
  assert.equal(r.verdict.verdict.type, "INSUFFICIENT_DATA");
  assert.equal(r.verdict.lobbyAnalysis.sampledMatches, 0);
});

test("per-act history carries the dominant server per act", () => {
  const stored = [
    ...history(10, 30, "Seoul", { seasonShort: "e11a5" }),
    ...history(10, 30, "Tokyo", { seasonShort: "e11a6" }).map((r) => ({ ...r, id: `${r.id}-new` })),
  ];
  const r = report({
    storedAll: stored,
    seasons: seasons([["e11a5", 20, "Diamond 3", 80], ["e11a6", 22, "Ascendant 2", 40]]),
  });
  const byAct = new Map(r.history.map((h) => [h.act, h]));
  assert.equal(byAct.get("e11a5")?.primaryServer, "Seoul");
  assert.equal(byAct.get("e11a6")?.primaryServer, "Tokyo");
});

test("empty evidence and unknown level are unavailable, not suspicious", () => {
  const r = report({ profile: prof({ level: 0 }) });
  assert.equal(r.audit.score, null);
  assert.deepEqual(r.audit.breakdown, { rankScore: 0, serverScore: 0, performanceScore: 0, activityScore: 0 });
  assert.deepEqual(r.verdict.scores, { smurfScore: null, altScore: null, outlierScore: null });
  assert.equal(r.verdict.estimatedTrueRank, null);
  assert.equal(r.verdict.benchmarksComparison, null);
});

test("stored counts do not bypass the roster gate", () => {
  const r = report({ storedAll: history(200, 400, "Tokyo"), profile: prof({ level: 30 }) });
  assert.equal(r.verdict.verdict.type, "INSUFFICIENT_DATA");
  assert.equal(r.verdict.estimatedTrueRank, null);
});

test("one match cannot produce performance changes or a rank", () => {
  const r = report({ storedAll: [row({})], rosterMatches: [compMatch("one", 20, {}, true)] });
  assert.equal(r.audit.score, null);
  assert.equal(r.audit.comparison.hasTransition, false);
  assert.equal(r.verdict.estimatedTrueRank, null);
});

test("unrated/deathmatch stats and duplicate stored IDs do not affect reports", () => {
  const stored = history(80, 150, "Tokyo");
  const clean = report({ storedAll: stored });
  const mixed = report({ storedAll: [...stored, ...stored, ...history(100, 200, "Mumbai", {
    mode: "Deathmatch", kills: 99, deaths: 1, head: 999,
  })] });
  assert.deepEqual(mixed.audit, clean.audit);
  assert.equal(mixed.sample.storedMatches, 80);
});

test("unknown server coverage adds no suspicion, shard names are equivalent", () => {
  const r = report({ storedAll: history(80, 250, "", { tier: 26 }) });
  assert.equal(r.audit.score, 0);
  assert.equal(r.serverStats.knownMatches, 0);
  const shards = report({ storedAll: history(80, 250, ["Tokyo 1", "Tokyo"], { tier: 26 }) });
  assert.equal(shards.lifetimeGenealogy.hasClusterFlip, false);
  assert.equal(shards.serverStats.percentages.Tokyo, 100);
});

test("PUUID identity survives renames; duplicate rosters are not extra evidence", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`puuid-${i}`, 20, {}, i % 2 === 0));
  for (const m of matches) { m.players[0].name = "FormerName"; m.players[0].tag = "OLD"; }
  const r = report({ rosterMatches: [...matches, ...matches] });
  assert.equal(r.verdict.lobbyAnalysis.sampledMatches, 12);
  assert.equal(r.sample.rosterMatches, 12);
  assert.equal(r.verdict.verdict.type, "NATURAL_PLAYER");
});

test("invalid teams, zero rounds and invalid ranks cannot support diagnosis", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`bad-${i}`, 20, {}, true));
  for (const m of matches) m.players[0].team_id = undefined;
  assert.equal(report({ rosterMatches: matches }).verdict.lobbyAnalysis.sampledMatches, 0);
  for (const m of matches) { m.players[0].team_id = "red"; m.metadata.rounds_played = 0; }
  assert.equal(report({ rosterMatches: matches }).verdict.lobbyAnalysis.sampledMatches, 0);
  for (const m of matches) { m.metadata.rounds_played = 24; m.players[0].currenttier = 28; }
  assert.equal(report({ rosterMatches: matches }).verdict.lobbyAnalysis.sampledMatches, 0);
});

test("draws are not losses and do not lower decided-match win rate", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`draw-${i}`, 20, {}, true));
  for (const m of matches.slice(6)) {
    m.teams.red.rounds_won = 12; m.teams.blue.rounds_won = 12;
    m.teams.red.has_won = false; m.teams.blue.has_won = false;
  }
  const r = report({ rosterMatches: matches });
  const band = r.verdict.lobbyAnalysis.eloBandPerformance[0];
  assert.equal(band.draws, 6);
  assert.equal(band.losses, 0);
  assert.equal(band.winRate, 100);
  assert.equal(r.verdict.benchmarksComparison?.playerStats.winRate, 100);
  assert.equal(r.verdict.benchmarksComparison?.zScores.wrZ, 2);
});

test("old rosters and lifetime outliers cannot change recent diagnosis", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`same-${i}`, 20, {}, i % 2 === 0));
  const clean = report({ rosterMatches: matches });
  const old = compMatch("old", 6, { kills: 90, deaths: 1, score: 14000 }, true);
  old.metadata.game_start = T0 - 365 * DAY;
  const mixed = report({ rosterMatches: [...matches, old], storedAll: history(100, 400, "Tokyo", {
    kills: 90, deaths: 1, score: 14000,
  }) });
  assert.deepEqual(mixed.verdict, clean.verdict);
});

test("latest opponent tier is independent of input order", () => {
  const old = compMatch("old-rank", 12, {}, false);
  const recent = compMatch("new-rank", 24, {}, false);
  recent.metadata.game_start += DAY;
  const a = report({ rosterMatches: [old, recent] });
  const b = report({ rosterMatches: [recent, old] });
  assert.deepEqual(a.verdict.lobbyAnalysis.encounteredOpponents, b.verdict.lobbyAnalysis.encounteredOpponents);
  assert.ok(a.verdict.lobbyAnalysis.encounteredOpponents.minTier >= 23);
});

test("different rank environments suppress performance-change scoring", () => {
  const early = history(40, 30, "Tokyo", { tier: 6 });
  const recent = history(40, 30, "Tokyo", { tier: 26, kills: 40, deaths: 10, score: 9000 })
    .map((r) => ({ ...r, id: `${r.id}-new`, startedAt: r.startedAt + 40 * DAY }));
  const r = report({ storedAll: [...early, ...recent] });
  assert.equal(r.comparison.comparable, false);
  assert.equal(r.audit.breakdown.performanceScore, 0);
});

test("short retrieved span and low level alone never imply an alt", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`low-${i}`, 20, {}, i % 2 === 0));
  const r = report({ profile: prof({ level: 25 }), rosterMatches: matches, storedAll: history(60, 1, "Tokyo") });
  assert.equal(r.verdict.scores.altScore, 0);
  assert.equal(r.audit.breakdown.activityScore, 0);
});

test("missing shot breakdown cannot masquerade as a 100% HS sample", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`missing-${i}`, 20, {}, true));
  for (const m of matches) m.players[0].stats.bodyshots = undefined;
  const r = report({ rosterMatches: matches });
  assert.equal(r.verdict.lobbyAnalysis.sampledMatches, 0);
  assert.equal(r.verdict.scores.outlierScore, null);
  const incomplete = report({ storedAll: history(80, 200, "Tokyo", { accuracyAvailable: false }) });
  assert.equal(incomplete.comparison.comparable, false);
  assert.equal(incomplete.audit.breakdown.performanceScore, 0);
});

test("outlier stats never produce a cheating verdict or calibrated probabilities", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`outlier-${i}`, 26, {
    kills: 90, deaths: 1, score: 20000, headshots: 99, bodyshots: 1, legshots: 0,
  }, true));
  const r = report({ rosterMatches: matches });
  assert.equal(r.verdict.verdict.type, "STATS_OUTLIER");
  assert.equal("cheatScore" in r.verdict.scores, false);
  assert.ok(r.verdict.estimatedTrueRank);
  assert.equal("probabilities" in r.verdict.estimatedTrueRank, false);
  assert.equal("confidenceInterval90" in r.verdict.estimatedTrueRank, false);
  const { minTier, maxTier } = r.verdict.estimatedTrueRank.modelRange;
  assert.ok(minTier >= 3 && maxTier <= 27 && maxTier - minTier >= 2);
});

test("an unknown agent does not silently select a Duelist benchmark", () => {
  assert.equal(agentRole("Veto"), "sentinel");
  assert.equal(agentRole(" Hush "), "duelist");
  assert.equal(agentRole("Future Agent"), "unknown");
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`agent-${i}`, 20, {}, true));
  for (const m of matches) m.players[0].character = "Future Agent";
  const r = report({ rosterMatches: matches });
  assert.equal(r.verdict.verdict.type, "INSUFFICIENT_DATA");
});

test("episode resets and non-adjacent acts do not count as abrupt rank jumps", () => {
  const r = report({
    storedAll: history(80, 250, "Tokyo"),
    seasons: seasons([["e9a3", 10, "Silver 2", 50], ["e10a1", 26, "Immortal 3", 50], ["e10a5", 10, "Silver 2", 50]]),
  });
  assert.equal(r.audit.breakdown.rankScore, 0);
});

test("correlated performance, server and agent changes are scored and explained", () => {
  const early = history(40, 30, "Singapore");
  const recent = history(40, 30, "Tokyo", {
    kills: 30, deaths: 12, score: 9000, head: 22, body: 15, agent: "Omen",
  }).map((r) => ({ ...r, id: `${r.id}-new`, startedAt: r.startedAt + 40 * DAY }));
  const r = report({ storedAll: [...early, ...recent] });
  assert.ok(r.audit.score !== null && r.audit.score >= 55);
  assert.ok(r.audit.breakdown.performanceScore > 0);
  assert.equal(r.audit.breakdown.serverScore, 15);
  assert.equal(r.audit.breakdown.activityScore, 15);
  assert.ok(r.audit.signals.some((s) => s.category === "performance" && s.severity === "warn"));
});

test("recent roster scope enforces mode, date, cap and best duplicate coverage", () => {
  const matches = Array.from({ length: 30 }, (_, i) => {
    const m = compMatch(`scope-${i}`, 20, {}, true);
    m.metadata.game_start += i * 60;
    return m;
  });
  const partial = { ...matches[29], players: [matches[29].players[0]] };
  const old = compMatch("too-old", 20, {}, true);
  old.metadata.game_start -= 200 * DAY;
  const future = compMatch("future", 20, {}, true);
  future.metadata.game_start += 200 * DAY;
  const otherMode = compMatch("uncompetitive", 20, {}, true);
  otherMode.metadata.mode_id = "uncompetitive";
  const missingMode = compMatch("missing-mode", 20, {}, true);
  missingMode.metadata.mode_id = undefined as unknown as string;
  missingMode.metadata.mode = undefined as unknown as string;
  const recent = recentReportRosters([partial, old, future, otherMode, missingMode, ...matches], "2026-10-30T00:00:00Z");
  assert.equal(recent.length, 25);
  assert.equal(recent[0].metadata.matchid, "scope-29");
  assert.equal(recent[0].players.length, 10);
});

test("diagnosis top-up is bounded, skips known complete rosters, and is unnecessary with enough data", () => {
  const rows = history(30, 20, "Tokyo");
  const stamp = "2026-10-30T00:00:00Z";
  assert.equal(selectDiagnosisDetailIds(rows, [], "self", stamp).length, DIAGNOSIS_DETAIL_CAP);
  const matches = Array.from({ length: 10 }, (_, i) => compMatch(`h${i}`, 20, {}, i % 2 === 0));
  assert.deepEqual(selectDiagnosisDetailIds(rows, matches, "self", stamp), []);
  matches[9].players[0].stats.bodyshots = undefined;
  const ids = selectDiagnosisDetailIds(rows, matches, "self", stamp);
  assert.equal(ids.length, 3);
  assert.ok(!ids.includes("h9"), "known complete but unsuitable matches must not be re-fetched");
  assert.ok(!ids.some((id) => matches.some((m) => m.metadata.matchid === id)));
  assert.deepEqual(selectDiagnosisDetailIds(rows.map((r) => ({ ...r, mode: "unrated" })), [], "self", stamp), []);
  assert.deepEqual(selectDiagnosisDetailIds(rows, [], "self", "invalid-timestamp"), []);
});

test("zero-death matches remain valid evidence and do not produce non-finite outputs", () => {
  const matches = Array.from({ length: 12 }, (_, i) => compMatch(`deathless-${i}`, 20, { deaths: 0 }, true));
  const r = report({ rosterMatches: matches });
  assert.equal(r.verdict.lobbyAnalysis.sampledMatches, 12);
  assert.ok(Number.isFinite(r.verdict.benchmarksComparison?.playerStats.kd));
  assert.ok(r.verdict.estimatedTrueRank);
  assert.ok(Number.isFinite(r.verdict.estimatedTrueRank.tier));
});

test("stored normalization preserves missing stats and shots as unavailable, not observed zeroes", () => {
  const raw: Parameters<typeof normalizeStoredMatch>[0] = {
    meta: { id: "normalized", map: { id: "", name: "Ascent" }, mode: "Competitive",
      started_at: "2026-10-01T00:00:00Z", season: { id: "", short: "e11a6" } },
    stats: { puuid: "self", team: "Red", character: { id: "", name: "Jett" },
      kills: 12, deaths: 12, assists: 3, score: 4800, shots: { head: 0, body: 20, leg: 0 } },
    teams: { red: 13, blue: 11 },
  };
  assert.equal(normalizeStoredMatch(raw).accuracyAvailable, true, "a real zero HS value is valid");
  assert.equal(normalizeStoredMatch(raw).statsAvailable, true);
  raw.stats.shots!.head = undefined;
  const missing = normalizeStoredMatch(raw);
  assert.equal(missing.accuracyAvailable, false);
  const r = report({ storedAll: Array.from({ length: 40 }, (_, i) => ({ ...missing, id: `missing-${i}` })) });
  assert.equal(r.comparison.before.accuracyCount, 0);
  assert.equal(r.comparison.comparable, false);
  raw.stats.team = undefined;
  const noTeam = normalizeStoredMatch(raw);
  assert.equal(noTeam.statsAvailable, false);
  assert.equal(report({ storedAll: [noTeam] }).sample.storedMatches, 0);
});

test("reported diagnosis dates cover analyzed matches only, not rejected rosters", () => {
  const valid = compMatch("valid-date", 20, {}, true);
  const invalid = compMatch("invalid-date", 20, {}, true);
  invalid.metadata.game_start += 7 * DAY;
  invalid.players[0].currenttier = 0;
  const r = report({ rosterMatches: [valid, invalid] });
  assert.equal(r.sample.diagnosisFrom, "2026-08-02");
  assert.equal(r.sample.diagnosisTo, "2026-08-02");
});
