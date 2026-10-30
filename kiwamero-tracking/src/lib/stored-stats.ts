import { normalizeCluster } from "./henrik-shared.ts";
import type { HDStoredMatch } from "./henrikdev";
import type { Match } from "./types";
import { agentRole, ROLE_META } from "./profile-stats.ts";

/** One stored match, normalized for aggregation. */
export interface StoredRow {
  id: string;
  map: string;
  mapId: string;
  mode: string;
  startedAt: number; // unix seconds
  day: string;
  seasonId: string;
  seasonShort: string;
  agent: string;
  agentId: string;
  tier: number;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  head: number;
  body: number;
  leg: number;
  dmgMade: number;
  dmgRecv: number;
  won: number;
  lost: number;
  rounds: number;
  result: "win" | "loss" | "draw";
  cluster: string;
  /** Riot ID shown on this stored match — changes across history flag renames. */
  selfName: string;
  selfTag: string;
  /** Account level at match time (0 when the endpoint omits it). */
  level: number;
  accuracyAvailable?: boolean;
  statsAvailable?: boolean;
}

export function normalizeStoredMatch(m: HDStoredMatch): StoredRow {
  const won = m.teams?.red ?? 0;
  const lost = m.teams?.blue ?? 0;
  const team = m.stats.team?.toLowerCase();
  const own = team === "red" ? won : team === "blue" ? lost : 0;
  const opp = team === "red" ? lost : team === "blue" ? won : 0;
  const started = Date.parse(m.meta.started_at) / 1000;
  return {
    id: m.meta.id,
    map: m.meta.map?.name ?? "Unknown",
    mapId: m.meta.map?.id ?? "",
    mode: m.meta.mode ?? "",
    startedAt: Number.isFinite(started) ? started : 0,
    day: new Date(started * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    seasonId: m.meta.season?.id ?? "",
    seasonShort: m.meta.season?.short ?? "",
    agent: m.stats.character?.name ?? "Unknown",
    agentId: m.stats.character?.id ?? "",
    tier: m.stats.tier ?? 0,
    score: m.stats.score ?? 0,
    kills: m.stats.kills ?? 0,
    deaths: m.stats.deaths ?? 0,
    assists: m.stats.assists ?? 0,
    head: m.stats.shots?.head ?? 0,
    body: m.stats.shots?.body ?? 0,
    leg: m.stats.shots?.leg ?? 0,
    dmgMade: m.stats.damage?.made ?? 0,
    dmgRecv: m.stats.damage?.received ?? 0,
    won: own,
    lost: opp,
    rounds: won + lost,
    result: own === opp ? "draw" : own > opp ? "win" : "loss",
    cluster: normalizeCluster(m.meta.cluster),
    selfName: m.stats.name ?? "",
    selfTag: m.stats.tag ?? "",
    level: m.stats.level ?? 0,
    accuracyAvailable: [m.stats.shots?.head, m.stats.shots?.body, m.stats.shots?.leg]
      .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0),
    statsAvailable: (team === "red" || team === "blue") &&
      [m.stats.kills, m.stats.deaths, m.stats.score, m.teams?.red, m.teams?.blue]
        .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0),
  };
}

/**
 * Convert a stored-match stat row into the v3 Match shape so stored history can
 * share the match-list pipeline. The roster contains only the profile owner —
 * HenrikDev's stored endpoint exposes self stats, not full rosters — so callers
 * must not treat `players` as a complete lobby (single-player matches also
 * suppress the match-placement badge downstream).
 */
export function storedRowToMatch(r: StoredRow, self: { puuid: string; name: string; tag: string }): Match {
  return {
    metadata: {
      map: r.map,
      game_length: 0,
      game_start: r.startedAt,
      game_start_patched: "",
      rounds_played: r.rounds,
      mode: r.mode,
      mode_id: r.mode,
      season_id: r.seasonId,
      platform: "pc",
      matchid: r.id,
      region: "",
      cluster: r.cluster,
    },
    teams: {
      red: { has_won: r.result === "win", rounds_won: r.won, rounds_lost: r.lost },
      blue: { has_won: r.result === "loss", rounds_won: r.lost, rounds_lost: r.won },
    },
    players: [{
      puuid: self.puuid,
      name: self.name,
      tag: self.tag,
      team_id: "red",
      character: r.agent,
      currenttier: r.tier || undefined,
      stats: {
        score: r.score,
        kills: r.kills,
        deaths: r.deaths,
        assists: r.assists,
        headshots: r.head,
        bodyshots: r.body,
        legshots: r.leg,
      },
      damage_made: r.dmgMade,
      damage_received: r.dmgRecv,
    }],
  };
}

export interface StatAggregate {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  hs: number;
  adr: number;
  acs: number;
  dd: number;
  rounds: number;
}

export function aggregate(rows: StoredRow[]): StatAggregate {
  let wins = 0, losses = 0, draws = 0, kills = 0, deaths = 0, assists = 0,
    head = 0, body = 0, leg = 0, made = 0, recv = 0, rounds = 0, score = 0;
  for (const r of rows) {
    if (r.result === "win") wins++;
    else if (r.result === "loss") losses++;
    else draws++;
    kills += r.kills; deaths += r.deaths; assists += r.assists;
    head += r.head; body += r.body; leg += r.leg;
    made += r.dmgMade; recv += r.dmgRecv; rounds += r.rounds; score += r.score;
  }
  const shots = head + body + leg;
  const decided = wins + losses;
  return {
    matches: rows.length,
    wins, losses, draws,
    winRate: decided ? (wins / decided) * 100 : 0,
    kills, deaths, assists,
    kd: deaths ? kills / deaths : kills,
    hs: shots ? (head / shots) * 100 : 0,
    adr: rounds ? made / rounds : 0,
    acs: rounds ? score / rounds : 0,
    dd: rounds ? (made - recv) / rounds : 0,
    rounds,
  };
}

export interface AgentStat {
  agent: string;
  agentId: string;
  icon: string;
  role: string;
  stats: StatAggregate;
}

export function agentIconUrl(agent: string) {
  const slug = agent.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o");
  return `/agents/${slug}.webp`;
}

/** Agent accent colors, measured from tracker.gg agent rows. */
const AGENT_COLORS: Record<string, string> = {
  astra: "#8377ff", breach: "#ff9860", brimstone: "#ff8a00", chamber: "#d3564f",
  clove: "#cd4dfd", cypher: "#b3bfba", deadlock: "#bbc2d3", fade: "#657488",
  gekko: "#3fd7aa", harbor: "#2e94ff", iso: "#674BFF", jett: "#98DCFF",
  "kay/o": "#54a5f0", killjoy: "#fddc4f", neon: "#2952A5", omen: "#3f4eff",
  phoenix: "#FF6C40", raze: "#FF5589", reyna: "#f650d3", sage: "#7ae6d4",
  skye: "#9bd193", sova: "#2688FF", tejo: "#c9b7a0", veto: "#c3a4f8",
  viper: "#60a24a", vyse: "#caa0f0", waylay: "#affb9b", yoru: "#414e94",
};

export function agentColor(agent: string): string {
  return AGENT_COLORS[agent.toLowerCase()] ?? "#99abbf";
}

export function agentColor25(agent: string): string {
  return `${agentColor(agent)}40`;
}

export function groupByAgent(rows: StoredRow[]): AgentStat[] {
  const acc = new Map<string, StoredRow[]>();
  for (const r of rows) {
    const list = acc.get(r.agent) ?? [];
    list.push(r);
    acc.set(r.agent, list);
  }
  return [...acc.entries()]
    .map(([agent, list]) => {
      const role = agentRole(agent);
      return {
        agent,
        agentId: list[0].agentId,
        icon: agentIconUrl(agent),
        role: role ? ROLE_META[role].label : "",
        stats: aggregate(list),
      };
    })
    .sort((a, b) => b.stats.matches - a.stats.matches);
}

export interface MapStat {
  map: string;
  mapId: string;
  stats: StatAggregate;
  topAgents: AgentStat[];
}

export function groupByMap(rows: StoredRow[]): MapStat[] {
  const acc = new Map<string, StoredRow[]>();
  for (const r of rows) {
    const list = acc.get(r.map) ?? [];
    list.push(r);
    acc.set(r.map, list);
  }
  return [...acc.entries()]
    .map(([map, list]) => ({
      map,
      mapId: list[0].mapId,
      stats: aggregate(list),
      topAgents: groupByAgent(list).slice(0, 3),
    }))
    .sort((a, b) => b.stats.matches - a.stats.matches);
}

export interface SeasonStat {
  seasonId: string;
  seasonShort: string;
  stats: StatAggregate;
  topAgent: AgentStat | null;
}

export function groupBySeason(rows: StoredRow[]): SeasonStat[] {
  const acc = new Map<string, StoredRow[]>();
  for (const r of rows) {
    if (!r.seasonId) continue;
    const list = acc.get(r.seasonId) ?? [];
    list.push(r);
    acc.set(r.seasonId, list);
  }
  return [...acc.entries()]
    .map(([seasonId, list]) => ({
      seasonId,
      seasonShort: list[0].seasonShort,
      stats: aggregate(list),
      topAgent: groupByAgent(list)[0] ?? null,
    }))
    .sort((a, b) => {
      const an = a.seasonShort, bn = b.seasonShort;
      const am = an.match(/^e(\d+)a(\d+)$/i);
      const bm = bn.match(/^e(\d+)a(\d+)$/i);
      if (am && bm) return (Number(bm[1]) * 10 + Number(bm[2])) - (Number(am[1]) * 10 + Number(am[2]));
      return bn.localeCompare(an);
    });
}

/** Match counts per calendar date ("YYYY-MM-DD") across the last `days` days. */
export function activityByDay(rows: StoredRow[], days = 60, now = Date.now()): Map<string, number> {
  const cutoff = now / 1000 - days * 86400;
  const acc = new Map<string, number>();
  for (const r of rows) {
    if (r.startedAt < cutoff) continue;
    const key = new Date(r.startedAt * 1000).toISOString().slice(0, 10);
    acc.set(key, (acc.get(key) ?? 0) + 1);
  }
  return acc;
}

/** Highest-kill matches, newest first on ties — for the Best Matches sidebar. */
export function bestMatchesByKills(rows: StoredRow[], limit = 5): StoredRow[] {
  return [...rows].sort((a, b) => b.kills - a.kills || b.startedAt - a.startedAt).slice(0, limit);
}

/** One other player met in ranked/competitive matches, for the Encounters tab. */
export interface EncounterStat {
  name: string;
  tag: string;
  agent: string;
  tier: number;
  tierPatched: string;
  playedWith: number; // matches queued together (same party_id)
  playedAgainst: number; // matches on the opposing team
  encounters: number; // matches in either team
  winsWith: number;
  winsAgainst: number; // matches they won while opposing you
  kills: number;
  deaths: number;
  killsAgainst: number;
  deathsAgainst: number;
  winRate: number;
  kd: number;
  lastPlayedAt: number;
  lastDay: string;
}

export function buildEncounters(matches: Match[], selfName: string, selfTag: string): EncounterStat[] {
  const acc = new Map<string, {
    name: string; tag: string; agent: string; tier: number; tierPatched: string;
    with_: number; against_: number; all: number;
    winsWith: number; winsAgainst: number;
    kills: number; deaths: number; killsAgainst: number; deathsAgainst: number;
    last: number; lastDay: string;
  }>();
  const selfKey = `${selfName}#${selfTag}`.toLowerCase();
  for (const m of matches) {
    const self = m.players.find((p) => `${p.name}#${p.tag}`.toLowerCase() === selfKey);
    const started = m.metadata.game_start ?? 0;
    const day = new Date(started * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const selfWon = self
      ? m.teams[self.team_id?.toLowerCase() === "red" ? "red" : "blue"]?.has_won ?? false
      : false;
    for (const p of m.players) {
      if (!p.name || `${p.name}#${p.tag}`.toLowerCase() === selfKey) continue;
      const key = `${p.name}#${p.tag}`.toLowerCase();
      const e = acc.get(key) ?? {
        name: p.name, tag: p.tag, agent: p.character, tier: 0, tierPatched: "",
        with_: 0, against_: 0, all: 0,
        winsWith: 0, winsAgainst: 0,
        kills: 0, deaths: 0, killsAgainst: 0, deathsAgainst: 0,
        last: 0, lastDay: "",
      };
      e.all++;
      const selfParty = self?.party_id;
      const sameParty = Boolean(selfParty) && p.party_id === selfParty;
      const sameTeam = Boolean(
        self && self.team_id && p.team_id?.toLowerCase() === self.team_id.toLowerCase(),
      );
      if (sameParty) {
        // "Played With" means premade (duo/trio/stack) — same party_id.
        e.with_++;
        if (selfWon) e.winsWith++;
        e.kills += p.stats?.kills ?? 0;
        e.deaths += p.stats?.deaths ?? 0;
      } else if (sameTeam) {
        // Same team but not queued together — still a teammate stat-wise.
        e.kills += p.stats?.kills ?? 0;
        e.deaths += p.stats?.deaths ?? 0;
      } else if (self) {
        e.against_++;
        if (!selfWon) e.winsAgainst++;
        e.killsAgainst += p.stats?.kills ?? 0;
        e.deathsAgainst += p.stats?.deaths ?? 0;
      }
      if (started >= e.last) {
        e.last = started;
        e.lastDay = day;
        e.agent = p.character;
        e.tier = p.currenttier ?? e.tier;
        e.tierPatched = p.currenttier_patched ?? e.tierPatched;
      }
      acc.set(key, e);
    }
  }
  return [...acc.values()]
    .map((e) => ({
      name: e.name,
      tag: e.tag,
      agent: e.agent,
      tier: e.tier,
      tierPatched: e.tierPatched,
      playedWith: e.with_,
      playedAgainst: e.against_,
      encounters: e.all,
      winsWith: e.winsWith,
      winsAgainst: e.winsAgainst,
      kills: e.kills,
      deaths: e.deaths,
      killsAgainst: e.killsAgainst,
      deathsAgainst: e.deathsAgainst,
      winRate: e.with_ ? (e.winsWith / e.with_) * 100 : 0,
      kd: e.deaths ? e.kills / e.deaths : e.kills,
      lastPlayedAt: e.last,
      lastDay: e.lastDay,
    }))
    .sort((a, b) => b.playedWith - a.playedWith || b.encounters - a.encounters);
}
