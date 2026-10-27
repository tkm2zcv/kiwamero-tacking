export interface Player {
  puuid: string;
  name: string;
  tag: string;
  team: string;
  level: number;
  character: string;
  currenttier: number;
  currenttier_patched: string;
  party_id: string;
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    bodyshots: number;
    headshots: number;
    legshots: number;
  };
  damage_made: number;
  damage_received: number;
  assets: {
    agent: { small: string };
    card: { small: string };
  };
}

export interface Match {
  metadata: {
    map: string;
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
    matchid: string;
    region: string;
    cluster: string;
  };
  teams: {
    red: { has_won: boolean; rounds_won: number; rounds_lost: number };
    blue: { has_won: boolean; rounds_won: number; rounds_lost: number };
  };
  players: { all_players: Player[] };
}

export interface AgentBreakdown {
  agent: string;
  name: string;
  icon: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: string;
  kd: string;
  acs: number;
}

export interface SeasonRank {
  episode: string;
  act: string;
  actCode: string;
  episodeColor: string;
  peakRank: string;
  peakTier: number;
  rankIcon: string;
  playtimeHours: number;
  wins: number;
  games: number;
  winRate: string;
  kd: string;
  hs: string;
  topAgent: { name: string; character: string; icon: string } | null;
}
