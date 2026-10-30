import test from "node:test";
import assert from "node:assert/strict";
import { buildAccountReport } from "../src/lib/account-report.ts";
import type { StoredRow } from "../src/lib/stored-stats.ts";
import type { Match, MatchPlayer, SeasonRank } from "../src/lib/types.ts";

const DAY = 86400;
const T0 = 1_700_000_000;

function row(over: Partial<StoredRow>): StoredRow {
  return {
    id: over.id ?? `m${Math.random().toString(36).slice(2)}`,
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
    rows.push(row({ id: `h${i}`, startedAt: T0 + i * (days * DAY) / n, cluster: c, ...per }));
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
    others.push(player(`o${i}`, `Opp${i}`, "T", i < 5 ? "blue" : "red", lobbyTier + (i % 2 ? 1 : -1)));
  }
  const self = player("self", "Player", "TAG", "red", lobbyTier, { kills: 13, deaths: 12, score: 5200, headshots: 7, bodyshots: 14, legshots: 3, ...selfStats });
  const players = [self, ...others.slice(0, 4), ...others.slice(4).map((p) => ({ ...p, team_id: "blue" }))];
  return {
    metadata: { matchid: id, mode_id: "competitive", mode: "Competitive", game_start: T0, rounds_played: 24 },
    teams: { red: { has_won: won, rounds_won: won ? 13 : 8, rounds_lost: won ? 8 : 13 }, blue: { has_won: !won } },
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
  assert.ok(r.audit.score < 20, `score ${r.audit.score}`);
  assert.equal(r.audit.grade, "C");
  assert.equal(r.audit.originFraud, false);
  assert.equal(r.lifetimeGenealogy.isRenamed, false);
  assert.equal(r.verdict.verdict.type, "NATURAL_PLAYER");
  assert.ok(r.verdict.scores.smurfScore < 50);
});

test("low-level high-performer in easy lobbies → smurf verdict", () => {
  // Silver-tier account dominating: kd ~1.7, acs ~330, hs ~34% vs Silver means.
  const stored = history(120, 60, "Tokyo", {
    tier: 10, kills: 22, deaths: 13, score: 7800, head: 11, body: 18, leg: 3, result: "win",
  });
  const roster = Array.from({ length: 8 }, (_, i) =>
    compMatch(`s${i}`, 10, { kills: 24, deaths: 13, score: 7900, headshots: 12, bodyshots: 20, legshots: 3 }, true));
  const r = report({
    profile: prof({ level: 45, currentTier: 10, currentRank: "Silver 2" }),
    storedAll: stored, rosterMatches: roster,
  });
  assert.ok(r.verdict.scores.smurfScore >= 50, `smurf ${r.verdict.scores.smurfScore}`);
  assert.equal(r.verdict.verdict.type, "SMURF_SUSPECT");
  assert.ok(r.verdict.estimatedTrueRank.tier > 10, `est ${r.verdict.estimatedTrueRank.tier}`);
  assert.ok(r.verdict.estimatedTrueRank.tierGap >= 2);
});

test("server relocation early→recent raises audit server score", () => {
  const stored = history(100, 300, ["Singapore", "Tokyo"], { tier: 22 });
  const r = report({
    profile: prof({ level: 600, currentTier: 22 }),
    seasons: seasons([["e10a1", 20, "Diamond 3", 60], ["e11a6", 22, "Ascendant 2", 40]]),
    storedAll: stored,
    rosterMatches: Array.from({ length: 5 }, (_, i) => compMatch(`f${i}`, 22, {}, i % 2 === 0)),
  });
  assert.equal(r.lifetimeGenealogy.hasClusterFlip, true);
  assert.equal(r.lifetimeGenealogy.earliestCluster, "Singapore");
  assert.ok(r.audit.breakdown.serverScore >= 30, `server ${r.audit.breakdown.serverScore}`);
  assert.ok(r.audit.score >= 30);
  assert.ok(r.audit.signals.some((s) => s.severity === "alert"));
});

test("rename detected from earliest stored row", () => {
  const stored = history(60, 200, "Tokyo", { tier: 20 });
  stored[0] = row({ id: "old", startedAt: T0 - 100 * DAY, selfName: "Former", selfTag: "OLD" });
  const r = report({ profile: prof({ name: "Player", tag: "TAG" }), storedAll: stored });
  assert.equal(r.lifetimeGenealogy.isRenamed, true);
  assert.equal(r.lifetimeGenealogy.originalName, "Former#OLD");
  assert.ok(r.audit.breakdown.activityScore >= 10);
});

test("insufficient data → INSUFFICIENT_DATA verdict", () => {
  const r = report({ storedAll: history(10, 20, "Tokyo"), rosterMatches: [] });
  assert.equal(r.verdict.verdict.type, "INSUFFICIENT_DATA");
  assert.equal(r.verdict.lobbyAnalysis.sampledMatches, 0);
});

test("per-act history carries the dominant server per act", () => {
  const stored = [
    ...history(10, 30, "Seoul", { seasonShort: "e11a5" }),
    ...history(10, 30, "Tokyo", { seasonShort: "e11a6" }),
  ];
  const r = report({
    storedAll: stored,
    seasons: seasons([["e11a5", 20, "Diamond 3", 80], ["e11a6", 22, "Ascendant 2", 40]]),
  });
  const byAct = new Map(r.history.map((h) => [h.act, h]));
  assert.equal(byAct.get("e11a5")?.primaryServer, "Seoul");
  assert.equal(byAct.get("e11a6")?.primaryServer, "Tokyo");
});
