import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_WATCHED_PLAYERS,
  batch,
  buildMatchEmbed,
  buildWebhookPayload,
  countEncounters,
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

test("summarizeMatchForNotify detects same-party members and their images", () => {
  const match: RawMatchForNotify = {
    metadata: { matchid: "party-1", map: "Ascent", mode: "Competitive", rounds_played: 24, game_start: 3000, season_id: "season-1" },
    teams: { red: { has_won: true, rounds_won: 13 }, blue: { has_won: false, rounds_won: 9 } },
    players: [
      {
        puuid: "me", name: "Meiy", tag: "B3L", character: "Jett", team: "Red", party_id: "party-a",
        currenttier_patched: "Radiant",
        assets: { agent: { small: "https://img.test/jett.png" }, card: { small: "https://img.test/card.png" } },
        stats: { score: 5000, kills: 20, deaths: 10, assists: 5 },
      },
      {
        puuid: "mate-1", name: "DuoOne", tag: "111", character: "Omen", team: "Red", party_id: "party-a",
        currenttier_patched: "Immortal 3",
        assets: { agent: { small: "https://img.test/omen.png" } },
        stats: { score: 3000, kills: 12, deaths: 14, assists: 6 },
      },
      {
        puuid: "mate-2", name: "DuoTwo", tag: "222", character: "Sage", team: "Red", party_id: "party-a",
        currenttier_patched: "Diamond 2",
        assets: { agent: { small: "https://img.test/sage.png" } },
        stats: { score: 2800, kills: 10, deaths: 12, assists: 8 },
      },
      {
        puuid: "enemy", name: "Enemy", tag: "999", character: "Reyna", team: "Blue", party_id: "party-b",
        stats: { score: 2500, kills: 10, deaths: 16, assists: 2 },
      },
    ],
  };

  const summary = summarizeMatchForNotify(match, "me");
  assert.ok(summary);
  assert.equal(summary.partyLabel, "Trio");
  assert.equal(summary.partyMembers.length, 2);
  assert.equal(summary.partyMembers[0].name, "DuoOne");
  assert.equal(summary.partyMembers[0].agentIcon, "https://img.test/omen.png");
  assert.equal(summary.agentIcon, "https://img.test/jett.png");

  const embed = buildMatchEmbed(
    { name: "Meiy", tag: "B3L" },
    {
      ...summary,
      partyMembers: [
        {
          ...summary.partyMembers[0],
          season: { matches: 12, kills: 120, deaths: 80, kd: 1.5, act: "E13A1" },
          encountersAct: 2,
          encountersAll: 3,
        },
      ],
    },
    "https://example.test/meiy",
  );
  assert.equal(embed.author?.name, "Meiy#B3L");
  assert.equal(embed.author?.url, "https://example.test/meiy");
  const party = embed.fields?.find((f) => f.name.includes("パーティ"));
  assert.match(party?.value ?? "", /\[DuoOne#111\]\(https:\/\/tracking\.kiwamero\.dev\/valorant\/profile\/riot\/DuoOne%23111\/overview\)/);
  assert.match(party?.value ?? "", /szn K\/D 1\.50/);
  assert.match(party?.value ?? "", /act 2 \/ all 3/);
});

test("countEncounters splits current act from all acts", () => {
  const mk = (id: string, season: string, memberPuuid?: string): RawMatchForNotify => ({
    metadata: { matchid: id, map: "Ascent", game_start: 1, season_id: season },
    teams: {},
    players: { all_players: [
      { puuid: "me", stats: {} },
      ...(memberPuuid ? [{ puuid: memberPuuid, stats: {} }] : []),
    ] },
  });
  const recent = [
    mk("m1", "act-c", "mate"),
    mk("m2", "act-c", "mate"),
    mk("m3", "act-old", "mate"),
    mk("m4", "act-c"), // member absent — not counted
  ];
  assert.deepEqual(countEncounters(recent, "mate", "act-c"), { act: 2, all: 3 });
  assert.deepEqual(countEncounters(recent, "ghost", "act-c"), { act: 0, all: 0 });
});

test("buildMatchEmbed colours wins and losses differently", () => {
  const win = buildMatchEmbed({ name: "Meiy", tag: "B3L" }, {
    matchid: "m1", map: "Sunset", mode: "Competitive", score: "13 : 11", won: true,
    kills: 20, deaths: 15, assists: 4, acs: 200, agent: "Jett",
    partyLabel: "Solo", partyMembers: [], scoreboard: [],
  }, "https://example.test/p");
  assert.equal(win.color, 0x16e5b4);
  assert.match(win.title, /Meiy#B3L — WIN on Sunset/);

  const loss = buildMatchEmbed({ name: "Meiy", tag: "B3L" }, {
    matchid: "m2", map: "Lotus", mode: "Competitive", score: "11 : 13", won: false,
    kills: 10, deaths: 20, assists: 2, acs: 120,
    partyLabel: "Duo", partyMembers: [], scoreboard: [],
  }, "https://example.test/p");
  assert.equal(loss.color, 0xe4485d);
  assert.match(loss.title, /LOSS/);
});

test("buildWebhookPayload never mentions anyone and caps embeds", () => {
  const embeds = Array.from({ length: 14 }, (_, i) => buildMatchEmbed({ name: "a", tag: "b" }, {
    matchid: `m${i}`, map: "Bind", mode: "Competitive", score: "13 : 0", won: true,
    kills: 1, deaths: 1, assists: 1, acs: 100,
    partyLabel: "Solo", partyMembers: [], scoreboard: [],
  }, "https://example.test/p"));
  const payload = buildWebhookPayload(embeds);
  assert.equal(payload.embeds.length, 10);
  assert.deepEqual(payload.allowed_mentions.parse, []);
});

test("batch splits into fixed chunks", () => {
  assert.deepEqual(batch([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(batch([], 2), []);
});
