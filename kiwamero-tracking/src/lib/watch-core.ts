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
  return fresh.slice(0, limit).reverse();
}

/** Stable key for the dedupe table across users. */
export function playerKey(riotName: string, riotTag: string): string {
  return `${riotName.toLowerCase()}#${riotTag.toLowerCase()}`;
}

export interface DiscordEmbed {
  title: string;
  url: string;
  description: string;
  color: number;
  timestamp?: string;
  footer?: { text: string };
  fields?: { name: string; value: string; inline?: boolean }[];
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
}

export function buildMatchEmbed(
  player: { name: string; tag: string },
  match: NewMatchSummary,
  profileUrl: string,
): DiscordEmbed {
  const result = match.won === true ? "WIN" : match.won === false ? "LOSS" : "RESULT";
  const color = match.won === true ? 0x16e5b4 : match.won === false ? 0xe4485d : 0xcbb765;
  const kd = match.deaths ? (match.kills / match.deaths).toFixed(2) : String(match.kills);
  return {
    title: `${player.name}#${player.tag} — ${result} on ${match.map}`,
    url: profileUrl,
    description: `${match.mode} · ${match.score}`,
    color,
    timestamp: new Date().toISOString(),
    footer: { text: "Kiwamero Tracking" },
    fields: [
      { name: "Agent", value: match.agent ?? "—", inline: true },
      { name: "K/D/A", value: `${match.kills} / ${match.deaths} / ${match.assists}`, inline: true },
      { name: "K/D", value: kd, inline: true },
      { name: "ACS", value: String(match.acs), inline: true },
    ],
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
  sendWebhook: (url: string, payload: unknown) => Promise<boolean>;
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
    take: MAX_WATCHED_PLAYERS * 20,
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

        const embeds = fresh
          .map((item) => summarizeMatchForNotify(item.raw, puuid!))
          .filter((m): m is NonNullable<typeof m> => m !== null)
          .map((match) =>
            buildMatchEmbed(
              { name: entry.riotName, tag: entry.riotTag },
              match,
              `https://tracking.kiwamero.dev/valorant/profile/riot/${encodeURIComponent(`${entry.riotName}#${entry.riotTag}`)}/overview`,
            ),
          );
        if (!embeds.length) continue;

        let delivered = true;
        for (const chunk of batch(embeds, 10)) {
          const ok = await deps.sendWebhook(webhookUrl, buildWebhookPayload(chunk));
          if (!ok) delivered = false;
        }

        if (!delivered) {
          summary.webhookFailures += 1;
          // Keep lastSeenGameStart unchanged so the next run retries.
          continue;
        }

        summary.matchesSent += fresh.length;
        const newest = fresh.reduce((a, b) => (a.game_start > b.game_start ? a : b));
        await db.watchlistEntry.update({
          where: { id: entry.id },
          data: {
            lastSeenGameStart: newest.game_start,
            lastNotifiedMatchId: newest.matchid,
            lastNotifiedAt: new Date(),
          },
        });
        log(`${key}: delivered ${fresh.length} match(es)`);
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

/** Discord webhook payload (one embed per match, max 10 per message). */
export function buildWebhookPayload(embeds: DiscordEmbed[], content?: string) {
  return {
    content: content ?? undefined,
    embeds: embeds.slice(0, 10),
    allowed_mentions: { parse: [] as string[] },
  };
}

export interface RawPlayerForNotify {
  puuid: string;
  character?: string;
  team?: string;
  team_id?: string;
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
  };
  teams: Record<string, { has_won?: boolean | null; rounds_won?: number } | undefined>;
  players: RawPlayerForNotify[] | { all_players?: RawPlayerForNotify[]; red?: RawPlayerForNotify[]; blue?: RawPlayerForNotify[] };
}

function playersOf(raw: RawMatchForNotify): RawPlayerForNotify[] {
  const p = raw.players;
  return Array.isArray(p) ? p : (p?.all_players ?? []);
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
  };
}


/** Split a list of matches into webhook payload batches. */
export function batch<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
