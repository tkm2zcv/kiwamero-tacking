export interface Profile {
  name: string;
  tag: string;
  puuid: string;
  level: number;
  region: string;
  cardId?: string;
  currentRank: string;
  currentTier: number;
  rr: number;
  rankPosition?: number;
  elo?: number;
  peakRank: string;
  peakTier?: number;
  peakAct?: string;
  peakRr?: number;
  radiantWins?: number;
  lastUpdated?: string;
  /** Current act code reported by Riot's MMR payload, e.g. "e11a6". */
  actCode?: string;
  /** Competitive wins and games in the current act (season totals). */
  seasonWins?: number;
  seasonGames?: number;
}

export interface Summary {
  winRate: number;
  matches: number;
  wins: number;
  losses: number;
  kd: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  hs: number;
  totalMatches: number;
}

export interface TopAgent {
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

export interface Teammate {
  name: string;
  tag: string;
  agent: string;
  rankName: string;
  tier: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  avgPlace: number;
}

export interface SeasonRank {
  episode: string;
  act: string;
  actCode: string;
  episodeColor?: string;
  peakRank: string;
  peakTier: number;
  rankIcon: string;
  /** Highest rank rating reached within this act (from MMR history). */
  rr?: number;
  playtimeHours?: number;
  wins?: number;
  games?: number;
  winRate?: string;
  kd?: string;
  hs?: string;
  topAgent?: { name: string; character?: string; icon?: string } | string;
}

export interface DiagnosisSignal {
  category?: string;
  severity?: string;
  type?: string;
  title: string;
  description: string;
}

export interface Diagnosis {
  playerStats: DiagnosisSignal[];
  topCluster: DiagnosisSignal[];
}

export interface MatchMetadata {
  map: string;
  game_length: number;
  game_start: number;
  game_start_patched: string;
  rounds_played: number;
  mode: string;
  mode_id: string;
  queue?: string;
  season_id: string;
  platform: string;
  matchid: string;
  region: string;
  cluster: string;
}

export interface MatchTeam {
  has_won: boolean;
  rounds_won: number;
  rounds_lost: number;
  roster?: unknown;
}

export interface MatchPlayer {
  puuid: string;
  name: string;
  tag: string;
  team_id?: string;
  level?: number;
  character: string;
  currenttier?: number;
  currenttier_patched?: string;
  player_card?: string;
  party_id?: string;
  stats: {
    score: number;
    kills: number;
    deaths: number;
    assists: number;
    headshots?: number;
    bodyshots?: number;
    legshots?: number;
  };
  damage_made?: number;
  damage_received?: number;
  ability_casts?: Record<string, number>;
  assets?: { card?: { small?: string; large?: string }; agent?: { small?: string } };
}

export interface Match {
  metadata: MatchMetadata;
  teams: Record<"red" | "blue", MatchTeam>;
  players: MatchPlayer[];
  rounds?: unknown[];
}

export interface ProfileBundle {
  profile: Profile;
  summary: Summary;
  topAgents: TopAgent[];
  teammates: Teammate[];
  seasons: SeasonRank[];
  diagnosis: Diagnosis;
  availableActs: string[];
  capturedAt: string;
  matches: Match[];
  source: "henrikdev" | "seed";
  /** Unavailable provider rows excluded from recent-match statistics, not counted as zeroes. */
  unavailableRecentMatches?: number;
}
