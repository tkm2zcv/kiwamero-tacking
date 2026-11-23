import test from "node:test";
import assert from "node:assert/strict";
import { runWatchCycle, type WatchDb, type WatchDeps } from "../src/lib/watch-core.ts";
import type { RawMatchForNotify, RawPlayerForNotify, WatchEntryRow } from "../src/lib/watch-core.ts";

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
  const deletes: string[] = [];
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
      delete: async (args) => {
        deletes.push(args.where.id);
        return null;
      },
    },
  };
  return { db, updates, deletes };
}

function rawMatch(matchid: string, gameStart: number): RawMatchForNotify {
  return {
    metadata: { matchid, map: "Sunset", mode: "Competitive", rounds_played: 24, game_start: gameStart },
    teams: { red: { has_won: true, rounds_won: 13 }, blue: { has_won: false, rounds_won: 9 } },
    players: [{ puuid: "puuid-1", character: "Jett", team: "Red", stats: { score: 4800, kills: 20, deaths: 15, assists: 4 } }],
  };
}

function deps(matches: RawMatchForNotify[], opts: { failWebhook?: boolean; failAfter?: number } = {}) {
  const sent: unknown[] = [];
  const sentFiles: { name: string; data: Uint8Array; type: string }[][] = [];
  const fetchCalls: string[] = [];
  let webhookCalls = 0;
  const deps: WatchDeps = {
    resolvePlayer: async () => ({ puuid: "puuid-1", region: "ap" }),
    fetchMatches: async (puuid) => {
      fetchCalls.push(puuid);
      return matches;
    },
    sendWebhook: async (_url, payload, files) => {
      webhookCalls += 1;
      if (opts.failWebhook || (opts.failAfter != null && webhookCalls > opts.failAfter)) return false;
      sent.push(payload);
      sentFiles.push(files ?? []);
      return true;
    },
    sleep: async () => {},
  };
  return { deps, sent, sentFiles, fetchCalls };
}

test("first cycle delivers only the newest match per entry", async () => {
  const rows = [entry({ id: "e1" })];
  const { db, updates } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(sent.length, 1);
  const payload = sent[0] as { embeds: { title: string }[] };
  assert.match(payload.embeds[0].title, /VICTORY/);
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

test("a muted entry sends nothing but still advances the cursor", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 100, notifyEnabled: 0 })];
  const { db, updates } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200), rawMatch("m3", 300)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 0);
  assert.equal(sent.length, 0);
  assert.equal(summary.muted, 1);
  // Silencing skips delivery only — unmuting must not replay the missed window.
  assert.deepEqual(updates.map((u) => u.data.lastSeenGameStart), [300]);
  assert.equal(updates[0].data.lastNotifiedMatchId, undefined);
});

test("only matches newer than the last delivered one are sent", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 100 })];
  const { db } = fakeDb(rows);
  const { deps: d, sent } = deps([rawMatch("m1", 100), rawMatch("m2", 200), rawMatch("m3", 300)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 2);
  assert.equal(sent.length, 2);
  for (const payload of sent as { embeds: unknown[] }[]) assert.equal(payload.embeds.length, 1);
});

test("party member info lands inside the single match message", async () => {
  const match = rawMatch("m1", 100);
  match.metadata.season_id = "season-1";
  const players = match.players as RawPlayerForNotify[];
  players[0].name = "Meiy";
  players[0].tag = "B3L";
  players[0].party_id = "party-1";
  players[0].currenttier_patched = "Radiant";
  players[0].assets = { agent: { small: "https://img.test/jett.png" } };
  players.push({
    puuid: "mate-1", name: "DuoOne", tag: "111", character: "Omen", team: "Red", party_id: "party-1",
    currenttier_patched: "Immortal 3",
    assets: { agent: { small: "https://img.test/omen.png" } },
    stats: { score: 3200, kills: 12, deaths: 14, assists: 7 },
  });
  const rows = [entry({ id: "e1" })];
  const { db } = fakeDb(rows);
  const { deps: d, sent } = deps([match]);
  const seasonCalls: string[] = [];
  d.fetchSeasonStats = async (puuid, _region, seasonId) => {
    seasonCalls.push(`${puuid}:${seasonId}`);
    return { matches: 12, kills: 120, deaths: 80, kd: 1.5, act: "E13A1" };
  };

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(sent.length, 1, "one message per match, no separate member embeds");
  assert.deepEqual(seasonCalls, ["mate-1:season-1"]);
  const embed = (sent[0] as { embeds: { fields?: { name: string; value: string }[] }[] }).embeds[0];
  const party = embed.fields?.find((f) => f.name.includes("パーティ"));
  assert.match(party?.value ?? "", /\[DuoOne#111\]\(https:\/\/tracking\.kiwamero\.dev/);
  assert.match(party?.value ?? "", /シーズンK\/D `1\.50`/);
});

test("a rendered match card is sent as one image attachment", async () => {
  const rows = [entry({ id: "e1" })];
  const { db } = fakeDb(rows);
  const { deps: d, sent, sentFiles } = deps([rawMatch("m1", 100)]);
  d.renderMatchCard = async () => new Uint8Array([1, 2, 3]);

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(summary.imagesSent, 1);
  assert.equal(summary.embedFallbacks, 0);
  assert.equal(sent.length, 1, "single message, not one per embed");
  const payload = sent[0] as { embeds: { image?: { url: string } }[]; attachments?: { filename: string }[] };
  assert.equal(payload.embeds[0].image?.url, "attachment://watch-match.png");
  assert.equal(payload.attachments?.[0].filename, "watch-match.png");
  assert.equal(sentFiles[0][0].name, "watch-match.png");
  assert.deepEqual([...sentFiles[0][0].data], [1, 2, 3]);
});

test("a failed card render falls back to separate embed messages", async () => {
  const rows = [entry({ id: "e1" })];
  const { db } = fakeDb(rows);
  const { deps: d, sent, sentFiles } = deps([rawMatch("m1", 100)]);
  d.renderMatchCard = async () => null;

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(summary.imagesSent, 0);
  assert.equal(summary.embedFallbacks, 1);
  assert.equal(sent.length, 1);
  assert.equal(sentFiles[0].length, 0);
  const payload = sent[0] as { embeds: { image?: unknown }[] };
  assert.equal(payload.embeds[0].image, undefined);
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

test("a mid-backlog webhook failure advances only through delivered matches", async () => {
  const rows = [entry({ id: "e1", lastSeenGameStart: 50 })];
  const { db, updates } = fakeDb(rows);
  const { deps: d, sent } = deps(
    [rawMatch("m1", 100), rawMatch("m2", 200), rawMatch("m3", 300)],
    { failAfter: 1 },
  );

  const summary = await runWatchCycle(db, d);

  assert.equal(summary.matchesSent, 1);
  assert.equal(summary.webhookFailures, 1);
  assert.equal(sent.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(rows[0].lastSeenGameStart, 100);
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
    entry({ id: "e1", riotName: "A", riotTag: "1", puuid: "p-a" }),
    entry({ id: "e2", riotName: "B", riotTag: "2", puuid: "p-b" }),
    entry({ id: "e3", riotName: "C", riotTag: "3", puuid: "p-c" }),
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

test("a rename keeps tracking by puuid and refreshes the stored name", async () => {
  // The entry still says the old Riot ID; the roster reports the new one.
  const rows = [entry({ id: "e1", riotName: "OldName", riotTag: "OLD" })];
  const { db, updates } = fakeDb(rows);
  const match = rawMatch("m1", 100);
  (match.players as RawPlayerForNotify[])[0].name = "NewName";
  (match.players as RawPlayerForNotify[])[0].tag = "N3W";
  const base = deps([match]);
  base.deps.resolvePlayer = async () => {
    throw new Error("name lookup must not run — the stored puuid survives renames");
  };

  const summary = await runWatchCycle(db, base.deps);

  assert.equal(summary.matchesSent, 1);
  const rename = updates.find((u) => u.data.riotName !== undefined);
  assert.deepEqual(rename?.data, { riotName: "NewName", riotTag: "N3W" });
  const embed = (base.sent[0] as { embeds: { title: string; author?: { url?: string } }[] }).embeds[0];
  assert.match(embed.title, /NewName#N3W/);
  assert.match(embed.author?.url ?? "", /NewName%23N3W/);
});

test("a successful name resolve persists puuid, region and canonical name", async () => {
  const rows = [entry({ id: "e1", puuid: null, region: null })];
  const { db, updates } = fakeDb(rows);
  const base = deps([rawMatch("m1", 100)]);
  base.deps.resolvePlayer = async () => ({ puuid: "puuid-1", region: "ap", name: "Meiy", tag: "B3L" });

  const summary = await runWatchCycle(db, base.deps);

  assert.equal(summary.matchesSent, 1);
  const bind = updates.find((u) => u.data.puuid !== undefined);
  assert.deepEqual(bind?.data, { puuid: "puuid-1", region: "ap" });
  assert.equal(base.fetchCalls[0], "puuid-1");
});

test("old and new entries for the same player merge into one fetch and one delivery", async () => {
  const rows = [
    entry({ id: "old", riotName: "OldName", riotTag: "OLD", lastSeenGameStart: 50 }),
    entry({ id: "new", riotName: "NewName", riotTag: "N3W" }),
  ];
  const { db, deletes } = fakeDb(rows);
  const { deps: d, fetchCalls, sent } = deps([rawMatch("m1", 100)]);

  const summary = await runWatchCycle(db, d);

  assert.equal(fetchCalls.length, 1, "one shared upstream query");
  assert.equal(sent.length, 1, "one notification — the row with progress wins");
  assert.deepEqual(deletes, ["new"], "the duplicate row is removed");
  assert.equal(summary.matchesSent, 1);
});

test("a name-keyed group resolves into a puuid group already processed this run", async () => {
  const rows = [
    entry({ id: "bound", riotName: "OldName", riotTag: "OLD", lastSeenGameStart: 50 }),
    entry({ id: "alias", riotName: "NewName", riotTag: "N3W", puuid: null, region: null }),
  ];
  const { db } = fakeDb(rows);
  const base = deps([rawMatch("m1", 100)]);
  base.deps.resolvePlayer = async (name) =>
    name === "NewName" ? { puuid: "puuid-1", region: "ap" } : null;

  const summary = await runWatchCycle(db, base.deps);

  // The alias resolves to puuid-1, which was already delivered this run — no
  // second fetch or duplicate notification.
  assert.equal(base.fetchCalls.length, 1);
  assert.equal(summary.matchesSent, 1);
});

test("subscriber count does not hide later players after the first 2000 rows", async () => {
  const rows = [
    ...Array.from({ length: 2000 }, (_, i) => entry({ id: `shared-${i}`, userId: `u${i}` })),
    entry({ id: "later-player", riotName: "Other", puuid: "other-puuid" }),
  ];
  const { db, updates } = fakeDb(rows);
  const match = rawMatch("m1", 100);
  (match.players as RawPlayerForNotify[]).push({
    puuid: "other-puuid", character: "Omen", team: "Blue",
    stats: { score: 3200, kills: 12, deaths: 14, assists: 7 },
  });
  const { deps: d } = deps([match]);
  const summary = await runWatchCycle(db, d);

  assert.equal(summary.playersChecked, 2);
  assert.equal(summary.entriesProcessed, 2001);
  assert.ok(updates.some((u) => u.id === "later-player"));
});
