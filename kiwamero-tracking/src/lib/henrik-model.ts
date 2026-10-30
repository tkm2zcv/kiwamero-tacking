/** Provider wire contracts and identifiers only; no request, credentials or DB dependencies. */
export const MATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface HDAccount {
  puuid: string;
  region: string;
  account_level: number;
  name: string;
  tag: string;
  card: { small: string; large: string; wide: string; id: string };
  last_update: string;
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

export interface HDMatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team?: string; // "Red" | "Blue" - absent in FFA modes
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
