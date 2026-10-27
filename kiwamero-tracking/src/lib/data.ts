import "server-only";
import type {
  Match, MatchPlayer, ProfileBundle, SeasonRank, Summary, TopAgent, Teammate,
} from "./types";
import { getAccount, getMatches, getMmr, getMmrHistory, HenrikDevError, tierIcon } from "./henrikdev";
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

function hdMatchPlayers(m: import("./henrikdev").HDMatch): import("./henrikdev").HDMatchPlayer[] {
  const pl = m.players;
  if (Array.isArray(pl)) return pl;
  return pl?.all_players ?? [];
}

function normalizeHDMatch(m: import("./henrikdev").HDMatch): Match {
  return {
    metadata: {
      map: typeof m.metadata.map === "string" ? m.metadata.map : m.metadata.map.name,
      game_length: m.metadata.game_length ?? 0,
      game_start: m.metadata.game_start,
      game_start_patched: m.metadata.game_start_patched,
      rounds_played: m.metadata.rounds_played,
      mode: m.metadata.mode,
      mode_id: m.metadata.mode_id,
      queue: m.metadata.queue,
      season_id: m.metadata.season_id,
      platform: m.metadata.platform,
      matchid: m.metadata.matchid,
      region: m.metadata.region,
      cluster: m.metadata.cluster,
    },
    teams: {
      red: {
        has_won: m.teams.red?.has_won ?? m.teams.red?.won ?? false,
        rounds_won: m.teams.red?.rounds_won ?? m.teams.red?.rounds?.won ?? 0,
        rounds_lost: m.teams.red?.rounds_lost ?? m.teams.red?.rounds?.lost ?? 0,
      },
      blue: {
        has_won: m.teams.blue?.has_won ?? m.teams.blue?.won ?? false,
        rounds_won: m.teams.blue?.rounds_won ?? m.teams.blue?.rounds?.won ?? 0,
        rounds_lost: m.teams.blue?.rounds_lost ?? m.teams.blue?.rounds?.lost ?? 0,
      },
    },
    players: hdMatchPlayers(m).map((p) => ({
      puuid: p.puuid,
      name: p.name,
      tag: p.tag,
      team_id: p.team ?? p.team_id,
      level: p.level,
      character: p.character,
      currenttier: p.currenttier ?? p.tier,
      player_card: p.player_card,
      party_id: p.party_id,
      stats: {
        score: p.stats.score ?? 0,
        kills: p.stats.kills ?? 0,
        deaths: p.stats.deaths ?? 0,
        assists: p.stats.assists ?? 0,
        headshots: p.stats.headshots,
        bodyshots: p.stats.bodyshots,
        legshots: p.stats.legshots,
      },
      damage_made: p.damage_made ?? p.stats.damage,
      damage_received: p.damage_received,
      ability_casts: p.ability_casts ?? (p.stats.c_casts !== undefined
        ? Object.fromEntries(
            Object.entries({
              c: p.stats.c_casts, q: p.stats.q_casts, e: p.stats.e_casts, x: p.stats.x_casts,
            }).filter((e): e is [string, number] => e[1] !== undefined)
          )
        : undefined),
      assets: p.assets,
    })),
    rounds: m.rounds,
  };
}

function teamOf(m: Match, p: MatchPlayer) {
  const id = p.team_id?.toLowerCase();
  return id === "red" || id === "blue" ? m.teams[id] : undefined;
}

function summarize(matches: Match[], puuid: string): Summary {
  let wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0, score = 0, dmg = 0, hs = 0, shots = 0;
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const team = teamOf(m, me);
    if (team?.has_won) wins++; else if (team) losses++;
    kills += me.stats.kills; deaths += me.stats.deaths; assists += me.stats.assists;
    score += me.stats.score; dmg += me.damage_made ?? 0;
    hs += me.stats.headshots ?? 0;
    shots += (me.stats.headshots ?? 0) + (me.stats.bodyshots ?? 0) + (me.stats.legshots ?? 0);
  }
  const n = matches.length || 1;
  const totalRounds = matches.reduce((a, m) => a + (m.metadata.rounds_played || 1), 0) || 1;
  return {
    winRate: (wins / n) * 100,
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
  const acc = new Map<string, { p: MatchPlayer; n: number; w: number; l: number; k: number; d: number }>();
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    for (const p of m.players) {
      if (p.puuid === puuid || !me.team_id || p.team_id !== me.team_id) continue;
      const a = acc.get(p.puuid) ?? { p, n: 0, w: 0, l: 0, k: 0, d: 0 };
      a.n++;
      const team = teamOf(m, me);
      if (team?.has_won) a.w++; else if (team) a.l++;
      a.k += p.stats.kills; a.d += p.stats.deaths;
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
    }));
}

async function loadFromHenrikDev(name: string, tag: string): Promise<ProfileBundle> {
    const account = await getAccount(name, tag);
    const region = account.region;
    const [mmr, hdMatches, history] = await Promise.all([
      getMmr(region, account.puuid).catch(() => null),
      getMatches(region, account.puuid, { size: 20 }).catch(() => [] as import("./henrikdev").HDMatch[]),
      getMmrHistory(region, account.puuid).catch(() => [] as import("./henrikdev").HDMmrHistoryEntry[]),
    ]);
    const matches = hdMatches.map(normalizeHDMatch);
    const seasons: SeasonRank[] = dedupeSeasons(history).map((s) => ({
      episode: s.season.short.startsWith("e") ? `Episode ${s.season.short.slice(1).replace("a", " Act ")}` : s.season.short,
      act: s.season.short.toUpperCase(),
      actCode: s.season.short,
      peakRank: s.tier.name,
      peakTier: s.tier.id,
      rankIcon: tierIcon(s.tier.id),
    }));
    const bundle: ProfileBundle = {
      profile: {
        name: account.name, tag: account.tag, puuid: account.puuid,
        level: account.account_level, region,
        cardId: account.card?.id,
        currentRank: mmr?.currenttier_patched ?? "Unrated",
        currentTier: mmr?.currenttier ?? 0,
        rr: mmr?.ranking_in_tier ?? 0,
        rankPosition: mmr?.leaderboard_rank,
        elo: mmr?.elo,
        peakRank: mmr?.peak?.tier?.patched ?? mmr?.currenttier_patched ?? "Unrated",
        peakAct: mmr?.peak?.season?.short,
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

function dedupeSeasons(history: import("./henrikdev").HDMmrHistoryEntry[]) {
  const best = new Map<string, { tier: { id: number; name: string }; season: { id: string; short: string } }>();
  for (const h of history) {
    const key = h.season?.id;
    if (!key || !h.tier) continue;
    const cur = best.get(key);
    if (!cur || h.tier.id > cur.tier.id) best.set(key, h as { tier: { id: number; name: string }; season: { id: string; short: string } });
  }
  return [...best.values()];
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

export async function loadProfile(name: string, tag: string): Promise<ProfileResult> {
  try {
    return { ok: true, bundle: await loadFromHenrikDev(name, tag) };
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
