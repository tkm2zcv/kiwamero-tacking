import type { Match, MatchPlayer, Summary } from "./types";

/** Summary of the retrieved sample, not lifetime totals. */
export function summarize(matches: Match[], puuid: string): Summary {
  const sample = matches.filter((m) => m.players.some((p) => p.puuid === puuid));
  const stats = deriveOverview(sample, puuid);
  const n = sample.length;
  return {
    winRate: stats.winRate, matches: n, totalMatches: n,
    wins: stats.wins, losses: stats.losses, kd: stats.kd,
    kills: n ? stats.kills / n : 0,
    deaths: n ? stats.deaths / n : 0,
    assists: n ? stats.assists / n : 0,
    acs: stats.acs, adr: stats.adr, hs: stats.hs,
  };
}

/** Agent → role. Used for the Roles card (tracker.gg shows the same split). */
const AGENT_ROLES: Record<string, RoleKey> = {
  jett: "duelist", phoenix: "duelist", reyna: "duelist", raze: "duelist", yoru: "duelist",
  neon: "duelist", iso: "duelist", waylay: "duelist", hush: "duelist",
  sova: "initiator", breach: "initiator", skye: "initiator", "kay/o": "initiator",
  fade: "initiator", gekko: "initiator", tejo: "initiator",
  brimstone: "controller", omen: "controller", astra: "controller", viper: "controller",
  harbor: "controller", clove: "controller", miks: "controller",
  sage: "sentinel", cypher: "sentinel", killjoy: "sentinel", chamber: "sentinel",
  deadlock: "sentinel", vyse: "sentinel", veto: "sentinel",
};

export type RoleKey = "duelist" | "initiator" | "controller" | "sentinel";

export const ROLE_META: Record<RoleKey, { label: string; icon: string }> = {
  duelist: { label: "Duelist", icon: "/roles/duelist.png" },
  initiator: { label: "Initiator", icon: "/roles/initiator.png" },
  controller: { label: "Controller", icon: "/roles/controller.png" },
  sentinel: { label: "Sentinel", icon: "/roles/sentinel.png" },
};

export function agentRole(agent: string): RoleKey | null {
  return AGENT_ROLES[agent.trim().toLowerCase()] ?? null;
}

function meOf(m: Match, puuid: string): MatchPlayer | undefined {
  return m.players.find((p) => p.puuid === puuid);
}

function wonMatch(m: Match, me: MatchPlayer): boolean | null {
  const id = me.team_id?.toLowerCase();
  if (id !== "red" && id !== "blue") return null;
  if (m.teams[id]?.has_won) return true;
  const other = m.teams[id === "red" ? "blue" : "red"];
  if (other?.has_won) return false;
  return null; // neither side won → draw
}

function scoreOf(m: Match, me: MatchPlayer): { won: number; lost: number } {
  const id = me.team_id?.toLowerCase();
  if (id !== "red" && id !== "blue") {
    return { won: me.stats.kills, lost: 0 };
  }
  const own = m.teams[id];
  const other = m.teams[id === "red" ? "blue" : "red"];
  return { won: own?.rounds_won ?? 0, lost: other?.rounds_won ?? 0 };
}

export function timeAgo(unixSeconds: number, now = Date.now()): string {
  const diff = Math.max(0, now / 1000 - unixSeconds);
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)}d ago`;
  if (diff < 86400 * 30) return `${Math.round(diff / (86400 * 7))}w ago`;
  return `${Math.round(diff / (86400 * 30))}mo ago`;
}

export function dayLabel(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Riot season code → display label, matching tracker.gg's scheme:
 *   e9a3  → "E9: A3"   (episodes < 10 keep the classic "E<n>: A<m>" style)
 *   e10a5 → "V25: A5"  (from episode 10 on Riot labels acts by year: V<ep+15>)
 *   e11a6 → "V26: A6"
 */
export function formatAct(raw?: string): string {
  if (!raw) return "Latest";
  const m = raw.toLowerCase().match(/^e(\d+)a(\d+)$/);
  if (!m) return raw.toUpperCase();
  const episode = Number(m[1]);
  const act = Number(m[2]);
  if (episode < 10) return `E${episode}: A${act}`;
  return `V${episode + 15}: A${act}`;
}

export interface MatchRow {
  matchId: string;
  map: string;
  mode: string;
  agent: string;
  startedAt: number;
  ago: string;
  day: string;
  result: "win" | "loss" | "draw";
  won: number;
  lost: number;
  kills: number;
  deaths: number;
  assists: number;
  hs: number;
  acs: number;
  adr: number;
  kd: number;
  kad: number;
  dd: number;
  place: string;
  agentIcon: string;
}

const PLACE_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];

/** `10/30 13:34` — local date+time for match rows. */
export function formatMatchTime(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function agentIconUrl(character: string) {
  const slug = character.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o");
  return `/agents/${slug}.webp`;
}

export function deriveMatchRows(matches: Match[], puuid: string, now = Date.now()): MatchRow[] {
  return matches.map((m) => {
    const me = meOf(m, puuid);
    if (!me) return null;
    const rounds = m.metadata.rounds_played || 1;
    const won = wonMatch(m, me);
    const score = scoreOf(m, me);
    const hs = me.stats.headshots ?? 0;
    const shots = hs + (me.stats.bodyshots ?? 0) + (me.stats.legshots ?? 0);
    const ranked = [...m.players].sort((a, b) => b.stats.score - a.stats.score);
    // Stored-history rows carry a self-only roster — placement is unknowable there.
    const place = m.players.length > 1 ? ranked.findIndex((p) => p.puuid === me.puuid) : -1;
    return {
      matchId: m.metadata.matchid,
      map: m.metadata.map,
      mode: m.metadata.mode || m.metadata.mode_id,
      agent: me.character,
      agentIcon: me.assets?.agent?.small ?? agentIconUrl(me.character),
      startedAt: m.metadata.game_start,
      ago: timeAgo(m.metadata.game_start, now),
      day: dayLabel(m.metadata.game_start),
      result: won === null ? "draw" : won ? "win" : "loss",
      won: score.won,
      lost: score.lost,
      kills: me.stats.kills,
      deaths: me.stats.deaths,
      assists: me.stats.assists,
      hs: shots ? Math.round((hs / shots) * 100) : 0,
      acs: Math.round(me.stats.score / rounds),
      adr: (me.damage_made ?? 0) / rounds,
      kd: me.stats.deaths ? me.stats.kills / me.stats.deaths : me.stats.kills,
      kad: me.stats.deaths ? (me.stats.kills + me.stats.assists) / me.stats.deaths : me.stats.kills,
      dd: Math.max(-120, Math.min(160, Math.round(((me.damage_made ?? 0) - (me.damage_received ?? 0)) / rounds))),
      place: place >= 0 ? PLACE_LABELS[place] : "—",
    } satisfies MatchRow;
  }).filter((r): r is MatchRow => r !== null);
}

export interface Accuracy {
  head: { pct: number; hits: number };
  body: { pct: number; hits: number };
  legs: { pct: number; hits: number };
}

export function deriveAccuracy(matches: Match[], puuid: string): Accuracy {
  let h = 0, b = 0, l = 0;
  for (const m of matches) {
    const me = meOf(m, puuid);
    if (!me) continue;
    h += me.stats.headshots ?? 0;
    b += me.stats.bodyshots ?? 0;
    l += me.stats.legshots ?? 0;
  }
  const total = h + b + l || 1;
  return {
    head: { pct: (h / total) * 100, hits: h },
    body: { pct: (b / total) * 100, hits: b },
    legs: { pct: (l / total) * 100, hits: l },
  };
}

export interface RoleStat {
  role: RoleKey;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
  kad: number;
  kills: number;
  deaths: number;
  assists: number;
}

export function deriveRoles(matches: Match[], puuid: string): RoleStat[] {
  const acc = new Map<RoleKey, RoleStat>();
  for (const key of Object.keys(ROLE_META) as RoleKey[]) {
    acc.set(key, { role: key, matches: 0, wins: 0, losses: 0, winRate: 0, kd: 0, kad: 0, kills: 0, deaths: 0, assists: 0 });
  }
  for (const m of matches) {
    const me = meOf(m, puuid);
    if (!me) continue;
    const role = agentRole(me.character);
    if (!role) continue;
    const s = acc.get(role)!;
    s.matches += 1;
    const won = wonMatch(m, me);
    if (won === true) s.wins += 1;
    else if (won === false) s.losses += 1;
    s.kills += me.stats.kills;
    s.deaths += me.stats.deaths;
    s.assists += me.stats.assists;
  }
  return [...acc.values()]
    .map((s) => ({
      ...s,
      winRate: s.wins + s.losses ? (s.wins / (s.wins + s.losses)) * 100 : 0,
      kd: s.deaths ? s.kills / s.deaths : s.kills,
      kad: s.deaths ? (s.kills + s.assists) / s.deaths : s.kills,
    }))
    .filter((s) => s.matches > 0)
    .sort((a, b) => b.matches - a.matches);
}

export interface MapStat {
  map: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export function deriveMaps(matches: Match[], puuid: string): MapStat[] {
  const acc = new Map<string, MapStat>();
  for (const m of matches) {
    const me = meOf(m, puuid);
    if (!me) continue;
    const s = acc.get(m.metadata.map) ?? { map: m.metadata.map, games: 0, wins: 0, losses: 0, winRate: 0 };
    s.games += 1;
    const won = wonMatch(m, me);
    if (won === true) s.wins += 1;
    else if (won === false) s.losses += 1;
    acc.set(m.metadata.map, s);
  }
  return [...acc.values()]
    .map((s) => ({ ...s, winRate: s.games ? (s.wins / s.games) * 100 : 0 }))
    .sort((a, b) => b.games - a.games || b.winRate - a.winRate);
}

export interface OverviewStats {
  kd: number;
  adr: number;
  hs: number;
  winRate: number;
  wins: number;
  losses: number;
  matches: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  kad: number;
  killsPerRound: number;
  ddPerRound: number;
  rounds: number;
  hsHits: number;
  bodyHits: number;
  legHits: number;
}

export function deriveOverview(matches: Match[], puuid: string): OverviewStats {
  let wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0, score = 0, dmgMade = 0,
    dmgRecv = 0, hs = 0, body = 0, leg = 0, rounds = 0;
  for (const m of matches) {
    const me = meOf(m, puuid);
    if (!me) continue;
    const r = m.metadata.rounds_played > 1 ? m.metadata.rounds_played : 0;
    const won = wonMatch(m, me);
    if (won === true) wins += 1;
    else if (won === false) losses += 1;
    kills += me.stats.kills;
    deaths += me.stats.deaths;
    assists += me.stats.assists;
    score += me.stats.score;
    dmgMade += me.damage_made ?? 0;
    dmgRecv += me.damage_received ?? 0;
    hs += me.stats.headshots ?? 0;
    body += me.stats.bodyshots ?? 0;
    leg += me.stats.legshots ?? 0;
    rounds += r;
  }
  const plays = wins + losses;
  const shotTotal = hs + body + leg;
  return {
    wins, losses, matches: matches.length,
    winRate: plays ? (wins / plays) * 100 : 0,
    kd: deaths ? kills / deaths : kills,
    adr: rounds ? dmgMade / rounds : 0,
    hs: shotTotal ? (hs / shotTotal) * 100 : 0,
    kills, deaths, assists,
    acs: rounds ? score / rounds : 0,
    kad: deaths ? (kills + assists) / deaths : kills,
    killsPerRound: rounds ? kills / rounds : 0,
    ddPerRound: rounds ? (dmgMade - dmgRecv) / rounds : 0,
    rounds,
    hsHits: hs,
    bodyHits: body,
    legHits: leg,
  };
}

/** Human "30h Playtime" from total match duration. */
export function playtimeLabel(matches: Match[]): string {
  const seconds = matches.reduce((a, m) => a + (m.metadata.game_length || 0), 0);
  const hours = seconds / 3600;
  return hours >= 1 ? `${Math.round(hours)}h Playtime` : `${Math.round(hours * 60)}m Playtime`;
}

/** Group matches by calendar day, newest first, keeping order. */
export function groupByDay(rows: MatchRow[]): { day: string; rows: MatchRow[] }[] {
  const groups: { day: string; rows: MatchRow[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.day === row.day) last.rows.push(row);
    else groups.push({ day: row.day, rows: [row] });
  }
  return groups;
}

export interface AgentMini {
  agent: string;
  icon: string;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
}

/** Top-N agents by match count for the match-list summary strip. */
export function deriveAgentMinis(matches: Match[], puuid: string, limit = 3): AgentMini[] {
  const acc = new Map<string, { matches: number; wins: number; losses: number; kills: number; deaths: number; icon: string }>();
  for (const m of matches) {
    const me = meOf(m, puuid);
    if (!me) continue;
    const s = acc.get(me.character) ?? { matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, icon: me.assets?.agent?.small ?? agentIconUrl(me.character) };
    s.matches += 1;
    const won = wonMatch(m, me);
    if (won === true) s.wins += 1;
    else if (won === false) s.losses += 1;
    s.kills += me.stats.kills;
    s.deaths += me.stats.deaths;
    acc.set(me.character, s);
  }
  return [...acc.entries()]
    .sort((a, b) => b[1].matches - a[1].matches)
    .slice(0, limit)
    .map(([agent, s]) => ({
      agent,
      icon: s.icon,
      matches: s.matches,
      wins: s.wins,
      losses: s.losses,
      winRate: s.wins + s.losses ? (s.wins / (s.wins + s.losses)) * 100 : 0,
      kd: s.deaths ? s.kills / s.deaths : s.kills,
    }));
}

export interface DayAggregate {
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  dd: number;
  adr: number;
  hs: number;
  acs: number;
}

/** Aggregate one day-group's rows for the group header stats. */
export function dayAggregate(rows: MatchRow[]): DayAggregate {
  let wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0, dd = 0, adr = 0, hs = 0, acs = 0;
  for (const r of rows) {
    if (r.result === "win") wins += 1;
    else if (r.result === "loss") losses += 1;
    kills += r.kills;
    deaths += r.deaths;
    assists += r.assists;
    dd += r.dd;
    adr += r.adr;
    hs += r.hs;
    acs += r.acs;
  }
  const n = rows.length || 1;
  return {
    wins, losses, kills, deaths, assists,
    kd: deaths ? kills / deaths : kills,
    dd: Math.round(dd / n),
    adr: Math.round((adr / n) * 10) / 10,
    hs: Math.round(hs / n),
    acs: Math.round(acs / n),
  };
}
