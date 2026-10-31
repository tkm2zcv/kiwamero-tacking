/**
 * Pure watch/notification logic. No Next.js, Prisma or network imports so it can
 * be unit-tested with `node --test` and reused by both the HTTP route and the
 * Worker scheduled handler.
 */

/** Hard cap from the product requirements: the whole system watches 100 players. */
export const MAX_WATCHED_PLAYERS = 100;
/** Maximum number of new matches delivered for one player in a single run. */
export const MAX_MATCHES_PER_RUN = 5;

export interface WatchMatch {
  matchid: string;
  game_start: number;
}

/**
 * Only Discord webhook URLs are accepted. Anything else (channels, arbitrary
 * hosts, http://, credentials in the URL) is rejected before it is stored.
 */
export function normalizeDiscordWebhook(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 300) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  const allowedHosts = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);
  if (!allowedHosts.has(host)) return null;
  if (!/^\/api\/(v\d+\/)?webhooks\/\d+\/[\w-]+$/.test(url.pathname)) return null;
  const token = url.pathname.split("/").pop() ?? "";
  if (token.length < 20) return null;
  // Drop query/hash: they are not part of the webhook identity.
  return `https://${host}${url.pathname}`;
}

/** Safe display form: keeps the webhook id, masks the token. */
export function redactWebhook(webhookUrl: string): string {
  try {
    const url = new URL(webhookUrl);
    const parts = url.pathname.split("/");
    const token = parts.pop() ?? "";
    return `${url.host}${parts.join("/")}/${token.slice(0, 4)}${"*".repeat(8)}`;
  } catch {
    return "invalid";
  }
}

/**
 * Matches that still have to be delivered.
 * - First run for a player (`lastSeenGameStart == null`): only the newest match,
 *   per the "notify the most recent match right after registration" rule.
 * - Afterwards: every match strictly newer than the newest delivered one,
 *   oldest first, capped to avoid webhook spam after downtime.
 */
export function pickNewMatches<T extends WatchMatch>(
  matches: T[],
  lastSeenGameStart: number | null,
  limit = MAX_MATCHES_PER_RUN,
): T[] {
  if (!matches.length) return [];
  const sorted = [...matches].sort((a, b) => b.game_start - a.game_start);
  if (lastSeenGameStart == null) return [sorted[0]];
  const fresh = sorted.filter((m) => m.game_start > lastSeenGameStart);
  return fresh.reverse().slice(0, limit);
}

/** Stable key for the dedupe table across users. */
export function playerKey(riotName: string, riotTag: string): string {
  return `${riotName.toLowerCase()}#${riotTag.toLowerCase()}`;
}

export interface DiscordEmbed {
  title: string;
  url: string;
  description?: string;
  color: number;
  timestamp?: string;
  author?: { name: string; url?: string; icon_url?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  footer?: { text: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

/** File attached to a webhook message via multipart/form-data. */
export interface WebhookFile {
  name: string;
  data: Uint8Array;
  type: string;
}

export interface SeasonStatsSummary {
  matches: number;
  kills: number;
  deaths: number;
  kd: number | null;
  act?: string;
}

export interface PartyMemberSummary {
  puuid: string;
  name: string;
  tag: string;
  agent?: string;
  agentIcon?: string;
  rank?: string;
  rankTier?: number;
  kills: number;
  deaths: number;
  assists: number;
  season?: SeasonStatsSummary | null;
  /** Matches met in the current act, counted over the fetched recent window. */
  encountersAct?: number;
  /** Matches met across all fetched matches regardless of act. */
  encountersAll?: number;
}

export interface ScoreboardRow {
  puuid: string;
  name: string;
  tag: string;
  agent?: string;
  agentIcon?: string;
  rank?: string;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  partyKey?: string;
  isWatched: boolean;
  isPartyMember: boolean;
  season?: SeasonStatsSummary | null;
}

export interface ScoreboardTeam {
  id: string;
  won: boolean | null;
  roundsWon?: number;
  players: ScoreboardRow[];
}

export interface NewMatchSummary {
  matchid: string;
  map: string;
  mode: string;
  score: string;
  won: boolean | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  agent?: string;
  agentIcon?: string;
  cardIcon?: string;
  rank?: string;
  rankTier?: number;
  gameStart?: number;
  partyLabel: string;
  partyMembers: PartyMemberSummary[];
  scoreboard: ScoreboardTeam[];
}

/** Kiwamero profile page used for embed links. */
export function watchProfileUrl(name: string, tag: string): string {
  return `https://tracking.kiwamero.dev/valorant/profile/riot/${encodeURIComponent(`${name}#${tag}`)}/overview`;
}

export function buildMatchEmbed(
  player: { name: string; tag: string },
  match: NewMatchSummary,
  profileUrl: string,
): DiscordEmbed {
  const result = match.won === true ? "WIN" : match.won === false ? "LOSS" : "RESULT";
  const color = match.won === true ? 0x16e5b4 : match.won === false ? 0xe4485d : 0xcbb765;
  const partyText = match.partyMembers.length
    ? match.partyMembers
        .map((m) => {
          const link = `[${m.name}#${m.tag}](${watchProfileUrl(m.name, m.tag)})`;
          const szn = m.season
            ? `  szn K/D ${(m.season.deaths ? m.season.kills / m.season.deaths : m.season.kills).toFixed(2)}`
            : "";
          const met = m.encountersAll != null
            ? `  act ${m.encountersAct ?? 0} / all ${m.encountersAll}`
            : "";
          return `${link}${szn}${met}`;
        })
        .join("\n")
    : "Solo queue";
  return {
    title: `${player.name}#${player.tag} — ${result} on ${match.map}`,
    url: `https://tracker.gg/valorant/match/${match.matchid}`,
    color,
    timestamp: match.gameStart ? new Date(match.gameStart * 1000).toISOString() : new Date().toISOString(),
    author: { name: `${player.name}#${player.tag}`, url: profileUrl, icon_url: match.cardIcon ?? match.agentIcon },
    thumbnail: match.agentIcon ? { url: match.agentIcon } : undefined,
    footer: { text: "監視通知 — Kiwamero Party Watch" },
    fields: match.partyMembers.length
      ? [{ name: "👥 パーティ", value: partyText, inline: false }]
      : undefined,
  };
}


export interface WatchEntryRow {
  id: string;
  userId: string;
  riotName: string;
  riotTag: string;
  puuid: string | null;
  region: string | null;
  lastSeenGameStart: number | null;
  user: { webhookUrl: string | null };
}

export interface WatchDb {
  watchlistEntry: {
    findMany: (args: unknown) => Promise<WatchEntryRow[]>;
    update: (args: unknown) => Promise<unknown>;
  };
}

export interface WatchDeps {
  fetchMatches: (puuid: string, region: string) => Promise<RawMatchForNotify[]>;
  resolvePlayer: (riotName: string, riotTag: string) => Promise<{ puuid: string; region: string } | null>;
  fetchSeasonStats?: (puuid: string, region: string, seasonId: string | undefined) => Promise<SeasonStatsSummary | null>;
  /** Render the match card PNG; return null to fall back to plain embeds. */
  renderMatchCard?: (match: NewMatchSummary, watched: { name: string; tag: string }) => Promise<Uint8Array | null>;
  sendWebhook: (url: string, payload: unknown, files?: WebhookFile[]) => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

export interface WatchSummary {
  playersChecked: number;
  entriesProcessed: number;
  matchesSent: number;
  webhookFailures: number;
  skipped: number;
  errors: string[];
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface WatchOptions {
  /** Restrict the cycle to one user (used right after a webhook is registered). */
  userId?: string;
  /** Cap players for this run (registration uses a small number). */
  maxPlayers?: number;
}

/**
 * One monitoring cycle: for every watched player, fetch recent matches once and
 * deliver unseen ones to each user's own Discord webhook.
 *
 * - Players are de-duplicated system-wide and capped at MAX_WATCHED_PLAYERS.
 * - First delivery for an entry sends only the newest match (registration rule).
 * - Dedupe uses the newest delivered `game_start`, so re-runs never repeat.
 */
export async function runWatchCycle(
  db: WatchDb,
  deps: WatchDeps,
  options: WatchOptions = {},
): Promise<WatchSummary> {
  const log = deps.log ?? (() => {});
  const sleep = deps.sleep ?? defaultSleep;
  const summary: WatchSummary = {
    playersChecked: 0,
    entriesProcessed: 0,
    matchesSent: 0,
    webhookFailures: 0,
    skipped: 0,
    errors: [],
  };

  const entries = await db.watchlistEntry.findMany({
    where: {
      user: { webhookUrl: { not: null } },
      ...(options.userId ? { userId: options.userId } : {}),
    },
    include: { user: { select: { webhookUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  const byPlayer = new Map<string, WatchEntryRow[]>();
  for (const entry of entries) {
    const key = playerKey(entry.riotName, entry.riotTag);
    const list = byPlayer.get(key) ?? [];
    list.push(entry);
    byPlayer.set(key, list);
  }

  const cap = Math.min(options.maxPlayers ?? MAX_WATCHED_PLAYERS, MAX_WATCHED_PLAYERS);
  const players = [...byPlayer.entries()].slice(0, cap);
  summary.skipped = Math.max(0, byPlayer.size - players.length);
  const seasonCache = new Map<string, Promise<SeasonStatsSummary | null>>();
  const seasonFor = (playerPuuid: string, playerRegion: string, seasonId: string | undefined) => {
    if (!deps.fetchSeasonStats) return Promise.resolve(null);
    const cacheKey = `${playerRegion}:${playerPuuid}:${seasonId ?? ""}`;
    let cached = seasonCache.get(cacheKey);
    if (!cached) {
      cached = deps.fetchSeasonStats(playerPuuid, playerRegion, seasonId).catch(() => null);
      seasonCache.set(cacheKey, cached);
    }
    return cached;
  };

  for (const [key, group] of players) {
    summary.playersChecked += 1;
    const first = group[0];
    let puuid = first.puuid;
    let region = first.region;
    try {
      if (!puuid || !region) {
        const account = await deps.resolvePlayer(first.riotName, first.riotTag);
        if (!account) {
          summary.errors.push(`${key}: account not found`);
          continue;
        }
        puuid = account.puuid;
        region = account.region;
      }
      const recent = await deps.fetchMatches(puuid, region);
      for (const entry of group) {
        summary.entriesProcessed += 1;
        const webhookUrl = entry.user.webhookUrl;
        if (!webhookUrl) continue;
        const fresh = pickNewMatches(
          recent.map((m) => ({ matchid: m.metadata.matchid, game_start: m.metadata.game_start, raw: m })),
          entry.lastSeenGameStart,
        );
        if (!fresh.length) continue;

        const deliveries: { item: (typeof fresh)[number]; match: NewMatchSummary; embed: DiscordEmbed }[] = [];
        for (const item of fresh) {
          const match = summarizeMatchForNotify(item.raw, puuid!);
          if (!match) continue;
          if (deps.fetchSeasonStats) {
            for (const member of match.partyMembers) {
              member.season = await seasonFor(member.puuid, region, item.raw.metadata.season_id);
            }
          }
          for (const member of match.partyMembers) {
            const encounters = countEncounters(recent, member.puuid, item.raw.metadata.season_id);
            member.encountersAct = encounters.act;
            member.encountersAll = encounters.all;
          }
          const embed = buildMatchEmbed(
            { name: entry.riotName, tag: entry.riotTag },
            match,
            watchProfileUrl(entry.riotName, entry.riotTag),
          );
          deliveries.push({ item, match, embed });
        }
        if (!deliveries.length) continue;

        let delivered = 0;
        for (const delivery of deliveries) {
          let complete = true;
          const cardFile = deps.renderMatchCard
            ? await deps.renderMatchCard(delivery.match, { name: entry.riotName, tag: entry.riotTag }).catch(() => null)
            : null;
          if (cardFile) {
            const { payload, file } = buildAttachmentPayload(
              delivery.embed,
              { name: "watch-match.png", data: cardFile, type: "image/png" },
            );
            complete = await deps.sendWebhook(webhookUrl, payload, [file]);
            if (!complete) summary.webhookFailures += 1;
          } else {
            const ok = await deps.sendWebhook(webhookUrl, buildWebhookPayload([delivery.embed]));
            if (!ok) {
              summary.webhookFailures += 1;
              complete = false;
            }
          }
          if (!complete) break;
          delivered += 1;
          summary.matchesSent += 1;
          await db.watchlistEntry.update({
            where: { id: entry.id },
            data: {
              lastSeenGameStart: delivery.item.game_start,
              lastNotifiedMatchId: delivery.item.matchid,
              lastNotifiedAt: new Date(),
            },
          });
        }
        if (delivered < deliveries.length) continue;
        log(`${key}: delivered ${delivered} match(es)`);
      }
      // Be polite to the upstream API (free tier is per-minute limited).
      await sleep(250);
    } catch (e) {
      const status = (e as { status?: number } | null)?.status;
      const message = typeof status === "number" ? `HTTP ${status}` : e instanceof Error ? e.message : "unknown";
      summary.errors.push(`${key}: ${message}`);
      log(`${key}: failed ${message}`);
    }
  }

  return summary;
}

/** Discord webhook payload builder; Discord accepts up to 10 embeds per request. */
export function buildWebhookPayload(embeds: DiscordEmbed[], content?: string) {
  return {
    content: content ?? undefined,
    embeds: embeds.slice(0, 10),
    allowed_mentions: { parse: [] as string[] },
  };
}

/**
 * Payload + file for a single-image notification. The embed references the
 * attached PNG via `attachment://`; Discord renders it as the large image.
 */
export function buildAttachmentPayload(
  embed: DiscordEmbed,
  file: WebhookFile,
): { payload: Record<string, unknown>; file: WebhookFile } {
  return {
    payload: {
      embeds: [{ ...embed, image: { url: `attachment://${file.name}` } }],
      attachments: [{ id: 0, filename: file.name, description: embed.title }],
      allowed_mentions: { parse: [] as string[] },
    },
    file,
  };
}

export interface RawPlayerForNotify {
  puuid: string;
  name?: string;
  tag?: string;
  character?: string;
  team?: string;
  team_id?: string;
  party_id?: string;
  currenttier?: number;
  currenttier_patched?: string;
  assets?: {
    agent?: { small?: string; bust?: string; full?: string; killfeed?: string };
    card?: { small?: string; large?: string; wide?: string };
  };
  stats: { score?: number; kills?: number; deaths?: number; assists?: number };
}

export interface RawMatchForNotify {
  metadata: {
    matchid: string;
    map: string | { name?: string };
    mode?: string;
    mode_id?: string;
    rounds_played?: number;
    game_start: number;
    season_id?: string;
  };
  teams: Record<string, { has_won?: boolean | null; rounds_won?: number } | undefined>;
  players: RawPlayerForNotify[] | { all_players?: RawPlayerForNotify[]; red?: RawPlayerForNotify[]; blue?: RawPlayerForNotify[] };
}

function playersOf(raw: RawMatchForNotify): RawPlayerForNotify[] {
  const p = raw.players;
  return Array.isArray(p) ? p : (p?.all_players ?? []);
}

/**
 * How often `memberPuuid` shows up inside the watched player's fetched match
 * window — the "who do they keep running into" counter. `act` only counts
 * matches in `currentSeasonId`; `all` counts the whole window.
 */
export function countEncounters(
  recent: RawMatchForNotify[],
  memberPuuid: string,
  currentSeasonId: string | undefined,
): { act: number; all: number } {
  let act = 0;
  let all = 0;
  for (const m of recent) {
    if (!playersOf(m).some((p) => p.puuid === memberPuuid)) continue;
    all += 1;
    if (currentSeasonId && m.metadata.season_id === currentSeasonId) act += 1;
  }
  return { act, all };
}

function partyLabel(size: number): string {
  if (size <= 1) return "Solo";
  if (size === 2) return "Duo";
  if (size === 3) return "Trio";
  return `${size}-stack`;
}

function partyMember(player: RawPlayerForNotify): PartyMemberSummary {
  return {
    puuid: player.puuid,
    name: player.name ?? "Unknown",
    tag: player.tag ?? "",
    agent: player.character,
    agentIcon: player.assets?.agent?.small ?? player.assets?.agent?.killfeed,
    rank: player.currenttier_patched,
    rankTier: player.currenttier,
    kills: player.stats.kills ?? 0,
    deaths: player.stats.deaths ?? 0,
    assists: player.stats.assists ?? 0,
  };
}

/** Turn a HenrikDev-shaped match into the small summary used in Discord. */
export function summarizeMatchForNotify(raw: RawMatchForNotify, puuid: string): NewMatchSummary | null {
  const players = playersOf(raw);
  const me = players.find((p) => p.puuid === puuid);
  if (!me) return null;
  const teamId = (me.team ?? me.team_id ?? "").toLowerCase();
  const own = raw.teams?.[teamId];
  const other = raw.teams?.[teamId === "red" ? "blue" : "red"];
  const rounds = raw.metadata.rounds_played && raw.metadata.rounds_played > 1 ? raw.metadata.rounds_played : 1;
  const map = typeof raw.metadata.map === "string" ? raw.metadata.map : (raw.metadata.map?.name ?? "Unknown");
  const score = own?.rounds_won != null && other?.rounds_won != null
    ? `${own.rounds_won} : ${other.rounds_won}`
    : `${me.stats.kills ?? 0} K`;
  const partyMembers = me.party_id
    ? players.filter((p) => p.puuid !== puuid && p.party_id === me.party_id).map(partyMember)
    : [];

  // Scoreboard: every player grouped by team, sorted by score desc. Shared
  // party_ids get letter badges (watched player's party first).
  const partyKeys = new Map<string, string>();
  if (me.party_id) partyKeys.set(me.party_id, "P1");
  for (const p of players) {
    if (p.party_id && !partyKeys.has(p.party_id) && players.some((q) => q !== p && q.party_id === p.party_id)) {
      partyKeys.set(p.party_id, `P${partyKeys.size + 1}`);
    }
  }
  const byTeam = new Map<string, ScoreboardRow[]>();
  for (const p of players) {
    const tid = (p.team ?? p.team_id ?? "ffa").toLowerCase();
    const row: ScoreboardRow = {
      puuid: p.puuid,
      name: p.name ?? "Unknown",
      tag: p.tag ?? "",
      agent: p.character,
      agentIcon: p.assets?.agent?.small ?? p.assets?.agent?.killfeed,
      rank: p.currenttier_patched,
      kills: p.stats.kills ?? 0,
      deaths: p.stats.deaths ?? 0,
      assists: p.stats.assists ?? 0,
      acs: Math.round((p.stats.score ?? 0) / rounds),
      partyKey: p.party_id ? partyKeys.get(p.party_id) : undefined,
      isWatched: p.puuid === puuid,
      isPartyMember: !!me.party_id && p.puuid !== puuid && p.party_id === me.party_id,
    };
    const list = byTeam.get(tid) ?? [];
    list.push(row);
    byTeam.set(tid, list);
  }
  const scoreboard: ScoreboardTeam[] = [...byTeam.entries()]
    .map(([id, rows]) => ({
      id,
      won: typeof raw.teams?.[id]?.has_won === "boolean" ? raw.teams[id]!.has_won! : null,
      roundsWon: raw.teams?.[id]?.rounds_won,
      players: rows.sort(
        (a, b) => b.acs - a.acs || players.findIndex((p) => p.puuid === a.puuid) - players.findIndex((p) => p.puuid === b.puuid),
      ),
    }))
    .sort((a, b) => (a.id === teamId ? -1 : b.id === teamId ? 1 : 0));

  return {
    matchid: raw.metadata.matchid,
    map,
    mode: raw.metadata.mode ?? raw.metadata.mode_id ?? "Match",
    score,
    won: typeof own?.has_won === "boolean" ? own.has_won : null,
    kills: me.stats.kills ?? 0,
    deaths: me.stats.deaths ?? 0,
    assists: me.stats.assists ?? 0,
    acs: Math.round((me.stats.score ?? 0) / rounds),
    agent: me.character,
    agentIcon: me.assets?.agent?.small ?? me.assets?.agent?.killfeed,
    cardIcon: me.assets?.card?.small,
    rank: me.currenttier_patched,
    rankTier: me.currenttier,
    gameStart: raw.metadata.game_start,
    partyLabel: partyLabel(partyMembers.length + 1),
    partyMembers,
    scoreboard,
  };
}


/** Split a list of matches into webhook payload batches. */
export function batch<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
