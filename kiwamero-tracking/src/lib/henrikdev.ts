// HenrikDev unofficial VALORANT API client (server-only).
// https://docs.henrikdev.xyz — free key at henrikdev.xyz, ~30 req/min free tier.

const BASE = "https://api.henrikdev.xyz";

const TIER_TABLE_UUID = "03621f52-342b-cf4e-4f86-9350a49c6d04";

export function tierIcon(tier: number, size: "small" | "large" = "large") {
  return `https://media.valorant-api.com/competitivetiers/${TIER_TABLE_UUID}/${tier}/${size}icon.png`;
}

export function playerCardArt(cardId: string, variant: "wideart" | "largeart" | "smallart" = "wideart") {
  return `https://media.valorant-api.com/playercards/${cardId}/${variant}.png`;
}

interface ApiResponse<T> {
  status: number;
  data: T;
  errors?: { message: string }[];
}

export class HenrikDevError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HenrikDevError";
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.HENRIK_API_KEY;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(key ? { Authorization: key } : {}),
      ...(init?.headers ?? {}),
    },
    ...(init?.cache === "no-store" ? {} : { next: { revalidate: 120 } }),
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (json.status !== 200) {
    throw new HenrikDevError(
      json.status ?? res.status,
      `henrikdev ${path} -> ${json.status}: ${json.errors?.[0]?.message ?? res.statusText}`
    );
  }
  return json.data;
}

export interface HDAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: { small: string; large: string; wide: string; id: string };
  last_update: string;
}

export async function getAccount(name: string, tag: string) {
  return call<HDAccount>(`/valorant/v1/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
}

export interface HDMmrData {
  currenttier: number;
  currenttier_patched: string;
  ranking_in_tier: number;
  mmr_change_to_last_game: number;
  elo: number;
  games_needed_for_rating?: number;
  leaderboard_rank?: number;
  images?: { small: string; large: string };
  peak?: { tier?: { id: number; patched: string }; season?: { short: string } };
}

export async function getMmr(region: string, puuid: string) {
  return call<HDMmrData>(`/valorant/v3/by-puuid/mmr/${region}/${puuid}`);
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

export async function getMatches(region: string, puuid: string, opts?: { mode?: string; size?: number }) {
  const params = new URLSearchParams();
  if (opts?.mode) params.set("mode", opts.mode);
  if (opts?.size) params.set("size", String(opts.size));
  const q = params.toString();
  // Match payloads exceed Next's 2MB data-cache limit — skip caching.
  return call<HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}${q ? `?${q}` : ""}`,
    { cache: "no-store" }
  );
}

export interface HDMmrHistoryEntry {
  match_id?: string;
  tier?: { id: number; name: string };
  map?: { id: string; name: string };
  season?: { id: string; short: string };
  rr?: number;
  last_change?: number;
  elo?: number;
  date?: string;
  date_raw?: number;
}

export async function getMmrHistory(region: string, puuid: string) {
  return call<HDMmrHistoryEntry[]>(`/valorant/v1/by-puuid/mmr-history/${region}/${puuid}`);
}

export async function getLifetimeMatchesCount(region: string, puuid: string) {
  const data = await call<{ total?: number } | HDMatch[]>(
    `/valorant/v3/by-puuid/matches/${region}/${puuid}?size=1`
  );
  return Array.isArray(data) ? data.length : (data.total ?? 0);
}
