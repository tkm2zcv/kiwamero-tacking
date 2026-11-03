import type { HDMatch, HDMatchPlayer } from "./henrik-model";
import { archivePayload } from "./match-archive-payload.ts";
import { HenrikDevError } from "./henrik-errors.ts";

const obj = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === "string" ? v : "";
const number = (v: unknown) => typeof v === "number" ? v : NaN;
const optionalNumber = (v: unknown) => typeof v === "number" ? v : undefined;

function player(value: unknown): HDMatchPlayer {
  const p = obj(value), stats = obj(p.stats), damage = obj(stats.damage);
  return {
    puuid: text(p.puuid), name: text(p.name), tag: text(p.tag),
    team: text(p.team_id), party_id: text(p.party_id) || undefined,
    character: text(obj(p.agent).name), level: number(p.account_level),
    currenttier: optionalNumber(obj(p.tier).id), currenttier_patched: text(obj(p.tier).name),
    player_card: text(obj(p.customization).card), assets: {},
    stats: {
      kills: number(stats.kills), deaths: number(stats.deaths),
      assists: number(stats.assists), score: number(stats.score),
      headshots: optionalNumber(stats.headshots), bodyshots: optionalNumber(stats.bodyshots),
      legshots: optionalNumber(stats.legshots),
    },
    damage_made: optionalNumber(damage.dealt), damage_received: optionalNumber(damage.received),
  };
}

function match(value: unknown, puuid: string): HDMatch {
  const raw = obj(value), meta = obj(raw.metadata), queue = obj(meta.queue);
  if (meta.is_completed !== true || !Array.isArray(raw.players) || !Array.isArray(raw.teams)) {
    throw new HenrikDevError(502, "Unavailable v4 roster");
  }
  const players = raw.players.map(player);
  if (!players.some((p) => p.puuid.toLowerCase() === puuid.toLowerCase())) {
    throw new HenrikDevError(502, "Roster owner mismatch");
  }
  const teams = Object.fromEntries(raw.teams.map((value) => {
    const t = obj(value), rounds = obj(t.rounds);
    if (typeof t.won !== "boolean") throw new HenrikDevError(502, "Missing team outcome");
    return [text(t.team_id).toLowerCase(), {
      has_won: t.won, rounds_won: number(rounds.won), rounds_lost: number(rounds.lost),
    }];
  })) as HDMatch["teams"];
  const rounds = (teams.red?.rounds_won ?? 0) + (teams.blue?.rounds_won ?? 0);
  const result: HDMatch = {
    metadata: {
      matchid: text(meta.match_id).toLowerCase(),
      map: { id: text(obj(meta.map).id), name: text(obj(meta.map).name) },
      game_version: text(meta.game_version), game_length: number(meta.game_length_in_ms),
      game_start: Date.parse(text(meta.started_at)) / 1000,
      game_start_patched: text(meta.started_at), rounds_played: rounds,
      mode: text(queue.name) || text(queue.id), mode_id: text(queue.id), queue: text(queue.id),
      season_id: text(obj(meta.season).id), region: text(meta.region),
      cluster: text(meta.cluster), platform: text(meta.platform), premier_info: meta.premier,
    },
    players, teams,
  };
  archivePayload(result);
  return result;
}

/** Advance by wire positions, not valid rosters; holes must not stall pagination. */
export function normalizeV4Page(data: unknown, puuid: string) {
  if (!Array.isArray(data)) throw new HenrikDevError(502, "Invalid v4 match history");
  const seen = new Set<string>(), matches: HDMatch[] = [];
  let unavailable = 0;
  for (const row of data) {
    try {
      const m = match(row, puuid);
      if (!seen.has(m.metadata.matchid)) { seen.add(m.metadata.matchid); matches.push(m); }
    } catch { unavailable++; }
  }
  return {
    received: data.length, matches, unavailable,
    fingerprint: JSON.stringify(data.map((row) => obj(obj(row).metadata).match_id ?? null)),
  };
}
