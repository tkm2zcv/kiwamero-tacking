import "server-only";
import type {
  Match, MatchPlayer, ProfileBundle, SeasonRank, Summary, TopAgent, Teammate,
} from "./types";
import { getAccount, getMatches, getMmr, getMmrHistory, HenrikDevError, tierIcon } from "./henrikdev";
import { normalizeHDMatch } from "./match-normalize";
import seedProfile from "@/data/profile.json";
import seedMatches from "@/data/matches.json";

const AGENT_SLUGS: Record<string, string> = {
  "kay/o": "kay-o",
};

function agentIcon(character: string) {
  const slug = AGENT_SLUGS[character.toLowerCase()] ?? character.toLowerCase().replace(/\s+/g, "-");
  return `/agents/${slug}.webp`;
}

function mapImage(map: string) {
  return `/maps/${map.toLowerCase().replace(/\s+/g, "-")}.webp`;
}
export { mapImage };

function teamOf(m: Match, p: MatchPlayer) {
  const id = p.team_id?.toLowerCase();
  return id === "red" || id === "blue" ? m.teams[id] : undefined;
}

export function summarize(matches: Match[], puuid: string): Summary {
  let wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0, score = 0, dmg = 0, hs = 0, shots = 0;
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const team = teamOf(m, me);
    if (team?.has_won) wins++; else if (team) losses++;
    kills += me.stats.kills; deaths += me.stats.deaths; assists += me.stats.assists;
    if (m.metadata.rounds_played > 1) {
      score += me.stats.score; dmg += me.damage_made ?? 0;
    }
    hs += me.stats.headshots ?? 0;
    shots += (me.stats.headshots ?? 0) + (me.stats.bodyshots ?? 0) + (me.stats.legshots ?? 0);
  }
  const n = matches.length || 1;
  const totalRounds = matches.reduce((a, m) => a + (m.metadata.rounds_played > 1 ? m.metadata.rounds_played : 0), 0) || 1;
  return {
    winRate: wins + losses ? (wins / (wins + losses)) * 100 : 0,
    matches: n, wins, losses,
    kd: deaths ? kills / deaths : kills,
    kills: kills / n, deaths: deaths / n, assists: assists / n,
    acs: (score / n) / (totalRounds / n),
    adr: dmg / totalRounds,
    hs: shots ? (hs / shots) * 100 : 0,
    totalMatches: n,
  };
}

function buildTopAgents(matches: Match[], puuid: string): TopAgent[] {
  const acc = new Map<string, { n: number; w: number; l: number; k: number; d: number; score: number; rounds: number }>();
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const a = acc.get(me.character) ?? { n: 0, w: 0, l: 0, k: 0, d: 0, score: 0, rounds: 0 };
    a.n++;
    const team = teamOf(m, me);
    if (team?.has_won) a.w++; else if (team) a.l++;
    a.k += me.stats.kills; a.d += me.stats.deaths; a.score += me.stats.score;
    a.rounds += m.metadata.rounds_played || 1;
    acc.set(me.character, a);
  }
  return [...acc.entries()]
    .sort((x, y) => y[1].n - x[1].n)
    .slice(0, 8)
    .map(([agent, s]) => ({
      agent, name: agent, icon: agentIcon(agent),
      matches: s.n, wins: s.w, losses: s.l, draws: 0,
      winRate: `${((s.w / s.n) * 100).toFixed(1)}%`,
      kd: (s.d ? s.k / s.d : s.k).toFixed(2),
      acs: Math.round(s.score / s.rounds),
    }));
}

function buildTeammates(matches: Match[], puuid: string): Teammate[] {
  const acc = new Map<string, { p: MatchPlayer; n: number; w: number; l: number; k: number; d: number; place: number }>();
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const ranked = [...m.players].sort((a, b) => b.stats.score - a.stats.score);
    const placeOf = (p: MatchPlayer) => ranked.indexOf(p) + 1;
    for (const p of m.players) {
      if (p.puuid === puuid || !me.team_id || p.team_id !== me.team_id) continue;
      const a = acc.get(p.puuid) ?? { p, n: 0, w: 0, l: 0, k: 0, d: 0, place: 0 };
      a.n++;
      const team = teamOf(m, me);
      if (team?.has_won) a.w++; else if (team) a.l++;
      a.k += p.stats.kills; a.d += p.stats.deaths;
      a.place += placeOf(p);
      acc.set(p.puuid, a);
    }
  }
  return [...acc.values()]
    .filter((x) => x.n > 1)
    .sort((a, b) => b.n - a.n)
    .slice(0, 6)
    .map((x) => ({
      name: x.p.name, tag: x.p.tag,
      agent: x.p.character.toLowerCase().replace(/\s+/g, "-"),
      rankName: x.p.currenttier ? String(x.p.currenttier) : "—",
      tier: x.p.currenttier ?? 0,
      matches: x.n, wins: x.w, losses: x.l,
      winRate: (x.w / x.n) * 100,
      kd: x.d ? x.k / x.d : x.k,
      avgPlace: x.place / x.n,
    }));
}

async function loadFromHenrikDev(name: string, tag: string, opts?: { mode?: string }): Promise<ProfileBundle> {
    const account = await getAccount(name, tag);
    const region = account.region;
    const [mmr, hdMatches, history] = await Promise.all([
      getMmr(region, account.puuid).catch(() => null),
      getMatches(region, account.puuid, { size: 25, mode: opts?.mode }).catch(() => [] as import("./henrikdev").HDMatch[]),
      getMmrHistory(region, account.puuid).catch(() => [] as import("./henrikdev").HDMmrHistoryEntry[]),
    ]);
    const matches = hdMatches.map(normalizeHDMatch);
    const bySeason = mmr?.by_season ?? {};
    const seasonCodes = Object.keys(bySeason);
    // Peak rank rating reached within each act, from MMR history.
    const rrBySeason = new Map<string, number>();
    for (const h of history) {
      const short = h.season?.short?.toLowerCase();
      const rr = h.ranking_in_tier ?? h.rr;
      if (!short || typeof rr !== "number") continue;
      rrBySeason.set(short, Math.max(rrBySeason.get(short) ?? 0, rr));
    }
    const seasons: SeasonRank[] = seasonCodes
      .map((code) => {
        const s = bySeason[code];
        const wins = s.wins ?? 0;
        const games = s.number_of_games ?? 0;
        const tier = s.final_rank ?? s.tier ?? 0;
        return {
          episode: code,
          act: code.toUpperCase(),
          actCode: code,
          peakRank: s.final_rank_patched ?? s.patched_tier ?? "Unranked",
          peakTier: tier,
          rankIcon: tierIcon(tier),
          rr: rrBySeason.get(code.toLowerCase()),
          wins,
          games,
          winRate: games ? `${((wins / games) * 100).toFixed(1)}%` : undefined,
        } satisfies SeasonRank;
      })
      .reverse();
    // Current act (last key of by_season) and its competitive totals.
    const actCode = seasonCodes[seasonCodes.length - 1];
    const actStats = actCode ? bySeason[actCode] : undefined;
    const peakRr = history.reduce<number | undefined>((best, h) => {
      const rr = h.ranking_in_tier ?? h.rr;
      if (typeof rr !== "number") return best;
      return best === undefined || rr > best ? rr : best;
    }, undefined);
    const bundle: ProfileBundle = {
      profile: {
        name: account.name, tag: account.tag, puuid: account.puuid,
        level: account.account_level, region,
        cardId: account.card?.id,
        currentRank: mmr?.current_data?.currenttierpatched ?? "Unrated",
        currentTier: mmr?.current_data?.currenttier ?? 0,
        rr: mmr?.current_data?.ranking_in_tier ?? 0,
        elo: mmr?.current_data?.elo,
        peakRank: mmr?.highest_rank?.patched_tier ?? mmr?.current_data?.currenttierpatched ?? "Unrated",
        peakAct: mmr?.highest_rank?.season,
        peakRr,
        actCode,
        seasonWins: actStats?.wins,
        seasonGames: actStats?.number_of_games,
        lastUpdated: account.last_update,
      },
      summary: summarize(matches, account.puuid),
      topAgents: buildTopAgents(matches, account.puuid),
      teammates: buildTeammates(matches, account.puuid),
      seasons,
      diagnosis: { playerStats: [], topCluster: [] },
      availableActs: [],
      capturedAt: new Date().toISOString(),
      matches,
      source: "henrikdev",
    };
    return bundle;
}

// Seed matches store players as { all_players, red, blue } — flatten to MatchPlayer[].
function normalizeSeedMatches(raw: unknown): Match[] {
  return (raw as Record<string, unknown>[]).map((m) => {
    const pl = m.players as { all_players?: MatchPlayer[] } | MatchPlayer[];
    const players = Array.isArray(pl) ? pl : (pl.all_players ?? []);
    return { ...(m as unknown as Match), players };
  });
}

export type ProfileResult =
  | { ok: true; bundle: ProfileBundle }
  | { ok: false; reason: "not_found" | "private" | "rate_limited" | "upstream" };

export async function loadProfile(name: string, tag: string, opts?: { mode?: string }): Promise<ProfileResult> {
  try {
    return { ok: true, bundle: await loadFromHenrikDev(name, tag, opts) };
  } catch (e) {
    console.error(`loadProfile(${name}#${tag}) failed:`, e);
    const status = e instanceof HenrikDevError ? e.status : null;
    if (status === 404) return { ok: false, reason: "not_found" };

    // Seed fallback only when the upstream API itself is unreachable —
    // and only for the exact bundled identity, never for arbitrary IDs.
    const seed = seedProfile as unknown as Omit<ProfileBundle, "matches" | "source">;
    const isSeedIdentity =
      seed.profile.name.toLowerCase() === name.toLowerCase() &&
      seed.profile.tag.toLowerCase() === tag.toLowerCase();
    if (isSeedIdentity) {
      return { ok: true, bundle: { ...seed, matches: normalizeSeedMatches(seedMatches), source: "seed" } };
    }
    if (status === 429) return { ok: false, reason: "rate_limited" };
    if (status === 401 || status === 403) return { ok: false, reason: "private" };
    return { ok: false, reason: "upstream" };
  }
}
