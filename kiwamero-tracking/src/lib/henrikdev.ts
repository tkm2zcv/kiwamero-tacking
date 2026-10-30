// HenrikDev unofficial VALORANT API client (server-only).
// https://docs.henrikdev.xyz — free key at henrikdev.xyz, ~30 req/min free tier.

import { HenrikDevError, henrikCall } from "./henrik-client.ts";

const TIER_TABLE_UUID = "03621f52-342b-cf4e-4f86-9350a49c6d04";

export function tierIcon(tier: number, size: "small" | "large" = "large") {
  return `https://media.valorant-api.com/competitivetiers/${TIER_TABLE_UUID}/${tier}/${size}icon.png`;
}

const TIER_GROUPS = [
  "Unrated", "Iron", "Bronze", "Silver", "Gold",
  "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant",
];
export function tierName(tier: number): string {
  if (tier <= 0) return "";
  const group = TIER_GROUPS[Math.floor(tier / 3)] ?? "";
  if (group === "Unrated" || group === "Radiant") return group;
  return group ? `${group} ${(tier % 3) + 1}` : "";
}

export function playerCardArt(cardId: string, variant: "wideart" | "largeart" | "smallart" = "wideart") {
  return `https://media.valorant-api.com/playercards/${cardId}/${variant}.png`;
}

/**
 * HenrikDev reports clusters as "City" or "City N" shard variants
 * ("Tokyo 1" vs "Tokyo") — same physical location, so collapse the suffix
 * for display, flag lookup, and relocation detection.
 */
export function normalizeCluster(cluster: string | null | undefined): string {
  return (cluster ?? "").replace(/\s+\d+$/, "");
}

// HTTP layer (cache, in-flight dedupe, key rotation) lives in henrik-client.ts.
// TTLs below keep every tab/page re-render free of upstream calls within the
// window; `fresh` bypasses for callers that need the newest data (watch cycle).
export { HenrikDevError };

const TTL_ACCOUNT = 600_000;
const TTL_MMR = 180_000;
const TTL_MMR_HISTORY = 600_000;
const TTL_MATCHES = 300_000;
const TTL_STORED_MATCHES = 300_000;
/** A finished match is immutable — cache aggressively (powers on-expand detail fetches). */
const TTL_MATCH_DETAIL = 86_400_000;

const call = henrikCall;

export interface HDAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: { small: string; large: string; wide: string; id: string };
  last_update: string;
}

export async function getAccount(name: string, tag: string, opts?: { fresh?: boolean }) {
  return call<HDAccount>(
    `/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    { ttl: TTL_ACCOUNT, fresh: opts?.fresh },
  );
}

export interface HDMmrData {
  current_data?: {
    currenttier: number;
    currenttierpatched: string;
    ranking_in_tier: number;
    mmr_change_to_last_game: number;
    elo: number;
    games_needed_for_rating?: number;
    images?: { small: string; large: string };
    old?: boolean;
  };
  highest_rank?: { tier: number; patched_tier: string; season: string; old?: boolean };
  by_season?: Record<string, {
    tier?: number;
    patched_tier?: string;
    wins?: number;
    number_of_games?: number;
    final_rank?: number;
    final_rank_patched?: string;
    act_rank_wins?: { tier: number; patched_tier: string }[];
  }>;
}

export async function getMmr(region: string, puuid: string, opts?: { fresh?: boolean }) {
  return call<HDMmrData>(
    `/valorant/v2/by-puuid/mmr/${region}/${puuid}`,
    { ttl: TTL_MMR, fresh: opts?.fresh },
  );
}

export interface HDMatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team?: string; // "Red" | "Blue" — absent in FFA modes
  team_id?: string;
  level: number;
  character: string;
  currenttier?: number;
  currenttier_patched?: string;
  tier?: number;
  player_card?: string;
  player_title?: string;
  party_id?: string;
  session_playtime?: number;
  behavior?: unknown;
  platform?: string;
  ability_casts?: Record<string, number>; // { c_cast, q_cast, e_cast, x_cast }
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    headshots?: number;
    legshots?: number;
    bodyshots?: number;
    damage?: number;
    c_casts?: number; q_casts?: number; e_casts?: number; x_casts?: number;
  };
  damage_made?: number;
  damage_received?: number;
  economy?: unknown;
  assets: { card?: { small: string; large: string }; agent?: { small: string; bust?: string; full?: string } };
}

export interface HDMatch {
  metadata: {
    matchid: string;
    map: { id: string; name: string } | string;
    game_version: string;
    game_length: number;
    game_start: number;
    game_start_patched: string;
    rounds_played: number;
    mode: string;
    mode_id: string;
    queue: string;
    season_id: string;
    platform: string;
    premier_info: unknown;
    region: string;
    cluster: string;
  };
  // v3 returns { all_players, red, blue }; some endpoints return a flat array.
  players: HDMatchPlayer[] | { all_players: HDMatchPlayer[]; red?: HDMatchPlayer[]; blue?: HDMatchPlayer[] };
  observers?: unknown[];
  coaches?: unknown[];
  teams: Record<"red" | "blue", {
    team_id?: string;
    has_won?: boolean | null;
    rounds_won?: number;
    rounds_lost?: number;
    rounds?: { won: number; lost: number };
    won?: boolean;
    roster?: unknown;
    premier_roster?: unknown;
  }>;
  rounds?: unknown[];
  kills?: unknown;
}

export async function getMatches(region: string, puuid: string, opts?: { mode?: string; size?: number; fresh?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.mode) params.set("mode", opts.mode);
  if (opts?.size) params.set("size", String(opts.size));
  const q = params.toString();
  return call<HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}${q ? `?${q}` : ""}`,
    { ttl: TTL_MATCHES, fresh: opts?.fresh }
  );
}

export interface HDStoredMatch {
  meta: {
    id: string;
    map: { id: string; name: string };
    version?: string;
    mode: string;
    started_at: string;
    season: { id: string; short: string };
    region?: string;
    cluster?: string;
  };
  stats: {
    puuid: string;
    name?: string;
    tag?: string;
    team?: string;
    level?: number;
    character: { id: string; name: string };
    tier?: number;
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    shots?: { head?: number; body?: number; leg?: number };
    damage?: { made?: number; received?: number };
  };
  teams?: { red?: number; blue?: number };
}

export async function getStoredMatches(region: string, puuid: string, opts?: { mode?: string; fresh?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.mode) params.set("mode", opts.mode);
  const q = params.toString();
  return call<HDStoredMatch[]>(
    `/valorant/v1/by-puuid/stored-matches/${region}/${puuid}${q ? `?${q}` : ""}`,
    { ttl: TTL_STORED_MATCHES, fresh: opts?.fresh }
  );
}

export interface HDMmrHistoryEntry {
  match_id?: string;
  currenttier?: number;
  currenttierpatched?: string;
  ranking_in_tier?: number;
  mmr_change_to_last_game?: number;
  elo?: number;
  map?: { id: string; name: string };
  season_id?: string;
  date?: string;
  date_raw?: number;
  tier?: { id: number; name: string };
  season?: { id: string; short: string };
  rr?: number;
}

export async function getMmrHistory(region: string, puuid: string, opts?: { fresh?: boolean }) {
  return call<HDMmrHistoryEntry[]>(
    `/valorant/v1/by-puuid/mmr-history/${region}/${puuid}`,
    { ttl: TTL_MMR_HISTORY, fresh: opts?.fresh },
  );
}

/** Full match detail (all players/rounds) for any match tracked upstream, e.g. stored history rows. */
export async function getMatch(matchId: string, opts?: { fresh?: boolean }) {
  return call<HDMatch>(
    `/valorant/v2/match/${matchId}`,
    { ttl: TTL_MATCH_DETAIL, fresh: opts?.fresh },
  );
}

export async function getLifetimeMatchesCount(region: string, puuid: string) {
  const data = await call<{ total?: number } | HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}?size=1`,
    { ttl: TTL_MATCHES },
  );
  return Array.isArray(data) ? data.length : (data.total ?? 0);
}
