import test from "node:test";
import assert from "node:assert/strict";
import { runWatchCycle, type WatchDb, type WatchDeps } from "../src/lib/watch-core.ts";
import type { RawMatchForNotify, WatchEntryRow } from "../src/lib/watch-core.ts";

function entry(overrides: Partial<WatchEntryRow> & { id: string }): WatchEntryRow {
  return {
    userId: "u1",
    riotName: "Meiy",
    riotTag: "B3L",
    puuid: "puuid-1",
    region: "ap",
    lastSeenGameStart: null,
    user: { webhookUrl: "https://discord.com/api/webhooks/1/abcdefghijklmnopqrstuvwxyz" },
    ...overrides,
  };
}

function fakeDb(rows: WatchEntryRow[]) {
  const updates: { id: string; data: Record<string, unknown> }[] = [];
  const db: WatchDb = {
    watchlistEntry: {
      findMany: async (args) => {
        const { take } = args as { take?: number };
        return rows.slice(0, take).map((r) => ({ ...r }));
      },
      update: async (args) => {
        const { where, data } = args as { where: { id: string }; data: Record<string, unknown> };
        updates.push({ id: where.id, data });
        const row = rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
    },
  };
  return { db, updates };
}

function rawMatch(matchid: string, gameStart: number): RawMatchForNotify {
  return {
    metadata: { matchid, map: "Sunset", mode: "Competitive", rounds_played: 24, game_start: gameStart },
    teams: { red: { has_won: true, rounds_won: 13 }, blue: { has_won: false, rounds_won: 9 } },
    players: [{ puuid: "puuid-1", character: "Jett", team: "Red", stats: { score: 4800, kills: 20, deaths: 15, assists: 4 } }],
  };
}

function deps(matches: RawMatchForNotify[], opts: { failWebhook?: boolean } = {}) {
  const sent: unknown[] = [];
  const fetchCalls: string[] = [];
  const deps: WatchDeps = {
    resolvePlayer: async () => ({ puuid: "puuid-1", region: "ap" }),
    fetchMatches: async (puuid) => {
      fetchCalls.push(puuid);
      return matches;
    },
    sendWebhook: async (_url, payload) => {
      if (opts.failWebhook) return false;
      sent.push(payload);
      return true;
    },
    sleep: async () => {},
  };
  return { deps, sent, fetchCalls };
}

test("first cycle delivers only the newest match per entry", async () => {
  const rows = [entry({ id: "e1" })];
  const { db, updates } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(sent.length, 1);
  const payload = sent[0] as { embeds: { title: string }[] };
  assert.match(payload.embeds[0].title, /WIN/);
  assert.equal(updates[0].data.lastSeenGameStart, 200);
  assert.equal(updates[0].data.lastNotifiedMatchId, "m2");
});

test("second cycle with the same data sends nothing", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 200 })];
  const { db, updates } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 0);
  assert.equal(sent.length, 0);
  assert.equal(updates.length, 0);
});

test("only matches newer than the last delivered one are sent", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 100 })];
  const { db } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200), rawMatch("m3", 300)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 2);
  const payload = sent[0] as { embeds: unknown[] };
  assert.equal(payload.embeds.length, 2);
});

test("a failed webhook keeps the cursor so the next run retries", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 50 })];
  const { db, updates } = fakeDb(rows);
  const { deps: d } = deps([rawMatch("m1", 100)], { failWebhook: true });

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.webhookFailures, 1);
  assert.equal(summary.matchesSent, 0);
  assert.equal(updates.length, 0);
  assert.equal(rows[0].lastSeenGameStart, 50);
});

test("players are queried once even when several users watch them", async () => {
  const rows = [
    entry({ id: "e1", userId: "u1" }),
    entry({ id: "e2", userId: "u2" }),
  ];
  const { db } = fakeDb(rows);
  const { deps: d, fetchCalls, sent } = deps([rawMatch("m1", 100)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(fetchCalls.length, 1, "shared upstream query");
  assert.equal(summary.matchesSent, 2);
  assert.equal(sent.length, 2);
});

test("the system-wide player cap is enforced per run", async () => {
  const rows = [
    entry({ id: "e1", riotName: "A", riotTag: "1" }),
    entry({ id: "e2", riotName: "B", riotTag: "2" }),
    entry({ id: "e3", riotName: "C", riotTag: "3" }),
  ];
  const { db } = fakeDb(rows);
  const { deps: d } = deps([rawMatch("m1", 100)]);

  const summary = await runWatchCycle(db, d, { maxPlayers: 2 });

  assert.equal(summary.playersChecked, 2);
  assert.equal(summary.skipped, 1);
});

test("a failing player does not abort the whole cycle", async () => {
  const rows = [
    entry({ id: "e1", riotName: "Broken", riotTag: "000", puuid: null, region: null }),
    entry({ id: "e2", riotName: "Meiy", riotTag: "B3L" }),
  ];
  const { db } = fakeDb(rows);
  const base = deps([rawMatch("m1", 100)]);
  const failing: WatchDeps = {
    ...base.deps,
    resolvePlayer: async (name) => {
      if (name === "Broken") throw Object.assign(new Error("not found"), { status: 404 });
      return { puuid: "puuid-1", region: "ap" };
    },
  };

  const summary = await runWatchCycle(db, failing);

  assert.equal(summary.playersChecked, 2);
  assert.equal(summary.matchesSent, 1);
  assert.equal(summary.errors.length, 1);
  assert.match(summary.errors[0], /HTTP 404/);
});

test("a backlog larger than one batch drains without losing older matches", async () => {
  const rows = [entry({ id: "backlog", lastSeenGameStart: 0 })];
  const { db } = fakeDb(rows);
  const { deps: d, sent } = deps(Array.from({ length: 8 }, (_, i) => rawMatch(`m${i + 1}`, i + 1)));

  assert.equal((await runWatchCycle(db, d)).matchesSent, 5);
  assert.equal(rows[0].lastSeenGameStart, 5);
  assert.equal((await runWatchCycle(db, d)).matchesSent, 3);
  assert.equal(rows[0].lastSeenGameStart, 8);
  assert.equal((await runWatchCycle(db, d)).matchesSent, 0);
  assert.equal((sent as { embeds: unknown[] }[]).flatMap((p) => p.embeds).length, 8);
});

test("subscriber count does not hide later players after the first 2000 rows", async () => {
  const rows = [
    ...Array.from({ length: 2000 }, (_, i) => entry({ id: `shared-${i}`, userId: `u${i}` })),
    entry({ id: "later-player", riotName: "Other" }),
  ];
  const { db, updates } = fakeDb(rows);
  const { deps: d } = deps([rawMatch("m1", 100)]);
  const summary = await runWatchCycle(db, d);

  assert.equal(summary.playersChecked, 2);
  assert.equal(summary.entriesProcessed, 2001);
  assert.ok(updates.some((u) => u.id === "later-player"));
});
