import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WATCHED_PLAYERS,
  batch,
  buildMatchEmbed,
  buildWebhookPayload,
  normalizeDiscordWebhook,
  pickNewMatches,
  playerKey,
  redactWebhook,
  summarizeMatchForNotify,
  type RawMatchForNotify,
} from "../src/lib/watch-core.ts";

const WEBHOOK = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz";

test("normalizeDiscordWebhook accepts discord hosts only", () => {
  assert.equal(normalizeDiscordWebhook(WEBHOOK), WEBHOOK);
  assert.equal(
    normalizeDiscordWebhook("https://discordapp.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"),
    "https://discordapp.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
  );
  assert.equal(
    normalizeDiscordWebhook("https://ptb.discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"),
    "https://ptb.discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
  );
});

test("normalizeDiscordWebhook drops query strings", () => {
  assert.equal(normalizeDiscordWebhook(`${WEBHOOK}?wait=true`), WEBHOOK);
});

test("normalizeDiscordWebhook rejects unsafe or malformed input", () => {
  const rejected = [
    "",
    "not a url",
    "http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    "https://evil.example/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    "https://discord.com/api/webhooks/123456789012345678", // too short token
    "https://discord.com/api/webhooks/123/short", // short token
    "https://user:pass@discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz",
    `https://discord.com/channels/1234/5678`,
    `https://discord.com/api/webhooks/123456789012345678/${"a".repeat(400)}`,
  ];
  for (const value of rejected) {
    assert.equal(normalizeDiscordWebhook(value), null, `should reject ${value}`);
  }
});

test("redactWebhook hides the token", () => {
  const masked = redactWebhook(WEBHOOK);
  assert.match(masked, /discord\.com\/api\/webhooks\/123456789012345678\/abcd\*{8}/);
  assert.equal(masked.includes("abcdefghijklmnopqrstuvwxyz"), false);
});

test("pickNewMatches sends only the newest match on the first run", () => {
  const matches = [
    { matchid: "a", game_start: 100 },
    { matchid: "c", game_start: 300 },
    { matchid: "b", game_start: 200 },
  ];
  assert.deepEqual(pickNewMatches(matches, null).map((m) => m.matchid), ["c"]);
});

test("pickNewMatches returns unseen matches oldest first", () => {
  const matches = [
    { matchid: "a", game_start: 100 },
    { matchid: "b", game_start: 200 },
    { matchid: "c", game_start: 300 },
    { matchid: "d", game_start: 400 },
  ];
  assert.deepEqual(pickNewMatches(matches, 150).map((m) => m.matchid), ["b", "c", "d"]);
  assert.deepEqual(pickNewMatches(matches, 400), []);
});

test("pickNewMatches caps the batch to avoid webhook spam", () => {
  const matches = Array.from({ length: 12 }, (_, i) => ({ matchid: `m${i}`, game_start: i + 1 }));
  const picked = pickNewMatches(matches, 0);
  assert.equal(picked.length, 5);
  // Drain the oldest unseen matches before advancing the cursor.
  assert.deepEqual(picked.map((m) => m.matchid), ["m0", "m1", "m2", "m3", "m4"]);
});

test("playerKey is case insensitive", () => {
  assert.equal(playerKey("Meiy", "B3L"), playerKey("meiy", "b3l"));
  assert.equal(MAX_WATCHED_PLAYERS, 100);
});

const teamMatch: RawMatchForNotify = {
  metadata: { matchid: "m1", map: "Sunset", mode: "Competitive", rounds_played: 24, game_start: 1000 },
  teams: {
    red: { has_won: true, rounds_won: 13 },
    blue: { has_won: false, rounds_won: 11 },
  },
  players: {
    all_players: [
      { puuid: "me", character: "Jett", team: "Red", stats: { score: 4800, kills: 20, deaths: 15, assists: 4 } },
      { puuid: "other", character: "Omen", team: "Blue", stats: { score: 3000, kills: 12, deaths: 18 } },
    ],
  },
};

test("summarizeMatchForNotify reads the v3 shape", () => {
  const summary = summarizeMatchForNotify(teamMatch, "me");
  assert.ok(summary);
  assert.equal(summary.matchid, "m1");
  assert.equal(summary.map, "Sunset");
  assert.equal(summary.won, true);
  assert.equal(summary.score, "13 : 11");
  assert.equal(summary.acs, 200);
  assert.equal(summary.agent, "Jett");
});

test("summarizeMatchForNotify tolerates FFA matches without teams", () => {
  const ffa: RawMatchForNotify = {
    metadata: { matchid: "m2", map: { name: "Corrode" }, mode_id: "deathmatch", rounds_played: 1, game_start: 2000 },
    teams: {},
    players: [{ puuid: "me", team_id: undefined, stats: { score: 40, kills: 40, deaths: 27, assists: 0 } }],
  };
  const summary = summarizeMatchForNotify(ffa, "me");
  assert.ok(summary);
  assert.equal(summary.map, "Corrode");
  assert.equal(summary.won, null);
  assert.equal(summary.score, "40 K");
  assert.equal(summary.mode, "deathmatch");
});

test("summarizeMatchForNotify returns null when the player is missing", () => {
  assert.equal(summarizeMatchForNotify(teamMatch, "nobody"), null);
});

test("buildMatchEmbed colours wins and losses differently", () => {
  const win = buildMatchEmbed({ name: "Meiy", tag: "B3L" }, {
    matchid: "m1", map: "Sunset", mode: "Competitive", score: "13 : 11", won: true,
    kills: 20, deaths: 15, assists: 4, acs: 200, agent: "Jett",
  }, "https://example.test/p");
  assert.equal(win.color, 0x16e5b4);
  assert.match(win.title, /Meiy#B3L — WIN on Sunset/);

  const loss = buildMatchEmbed({ name: "Meiy", tag: "B3L" }, {
    matchid: "m2", map: "Lotus", mode: "Competitive", score: "11 : 13", won: false,
    kills: 10, deaths: 20, assists: 2, acs: 120,
  }, "https://example.test/p");
  assert.equal(loss.color, 0xe4485d);
  assert.match(loss.title, /LOSS/);
});

test("buildWebhookPayload never mentions anyone and caps embeds", () => {
  const embeds = Array.from({ length: 14 }, (_, i) => buildMatchEmbed({ name: "a", tag: "b" }, {
    matchid: `m${i}`, map: "Bind", mode: "Competitive", score: "13 : 0", won: true,
    kills: 1, deaths: 1, assists: 1, acs: 100,
  }, "https://example.test/p"));
  const payload = buildWebhookPayload(embeds);
  assert.equal(payload.embeds.length, 10);
  assert.deepEqual(payload.allowed_mentions.parse, []);
});

test("batch splits into fixed chunks", () => {
  assert.deepEqual(batch([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(batch([], 2), []);
});
