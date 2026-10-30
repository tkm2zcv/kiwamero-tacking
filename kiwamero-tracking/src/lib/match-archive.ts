import { execute, queryOne } from "./db.ts";
import { HenrikDevError } from "./henrik-errors.ts";
import { hdMatchPlayers, normalizeHDMatch } from "./match-normalize.ts";
import type { HDMatch } from "./henrikdev";

export interface ArchiveRow {
  matchId: string; payload: string | null; attempts: number; terminal: number;
  retryAt: number; leaseUntil: number; lastStatus: number | null;
}
const pending = new Map<string, Promise<HDMatch>>();
export const MATCH_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Store only ended, structurally complete data, not rounds/events/economy blobs. */
export function archivePayload(raw: HDMatch, id = raw.metadata?.matchid): string {
  if (hdMatchPlayers(raw).some((p) => ![p.stats?.score, p.stats?.kills, p.stats?.deaths]
    .every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0))) {
    throw new HenrikDevError(502, "Missing match statistics");
  }
  const match = normalizeHDMatch(raw);
  const competitive = (match.metadata.mode_id || match.metadata.mode || "").toLowerCase() === "competitive";
  if (!MATCH_ID.test(id) || match.metadata.matchid !== id ||
    !(match.metadata.game_start > 0) || !(match.metadata.game_length > 0) ||
    match.players.length < 2 || match.players.length > 30 ||
    new Set(match.players.map((p) => p.puuid)).size !== match.players.length ||
    match.players.some((p) => !p.puuid || !p.character ||
      ![p.stats.kills, p.stats.deaths, p.stats.score].every((n) => Number.isFinite(n) && n >= 0)) ||
    (competitive && (match.players.length !== 10 ||
      match.players.filter((p) => p.team_id?.toLowerCase() === "red").length !== 5 ||
      match.players.filter((p) => p.team_id?.toLowerCase() === "blue").length !== 5 ||
      match.metadata.rounds_played !== (match.teams.red.rounds_won ?? 0) + (match.teams.blue.rounds_won ?? 0)))) {
    throw new HenrikDevError(502, "Incomplete match detail");
  }
  const players = hdMatchPlayers(raw).map((p) => ({
    puuid: p.puuid, name: p.name, tag: p.tag, team: p.team ?? p.team_id,
    character: p.character, currenttier: p.currenttier ?? p.tier, level: p.level,
    party_id: p.party_id, stats: p.stats, assets: p.assets,
    damage_made: p.damage_made, damage_received: p.damage_received,
    player_card: p.player_card, ability_casts: p.ability_casts,
  }));
  const payload = JSON.stringify({ metadata: raw.metadata, players, teams: raw.teams });
  if (new TextEncoder().encode(payload).length > 500_000) throw new HenrikDevError(502, "Match detail too large");
  return payload;
}

export async function rememberMatch(raw: HDMatch) {
  const payload = archivePayload(raw);
  await execute(
    `INSERT INTO MatchArchive(matchId, payload, fetchedAt) VALUES (?, ?, ?)
     ON CONFLICT(matchId) DO UPDATE SET payload = excluded.payload, fetchedAt = excluded.fetchedAt,
       terminal = 0, retryAt = 0, lastStatus = 200
     WHERE MatchArchive.payload IS NULL AND MatchArchive.leaseUntil <= ?`,
    [raw.metadata.matchid, payload, Date.now(), Date.now()],
  );
}

export async function readArchivedMatch(id: string): Promise<HDMatch | null> {
  const row = await queryOne<{ payload: string | null }>("SELECT payload FROM MatchArchive WHERE matchId = ?", [id]);
  return row?.payload ? JSON.parse(row.payload) as HDMatch : null;
}

export async function claimMatch(id: string, now = Date.now(), fresh = false) {
  await execute("INSERT OR IGNORE INTO MatchArchive(matchId) VALUES (?)", [id]);
  const token = crypto.randomUUID();
  const row = await queryOne<{ attempts: number }>(
    `UPDATE MatchArchive SET leaseToken = ?, leaseUntil = ?, attempts = attempts + 1
     WHERE matchId = ? AND leaseUntil <= ? AND (? OR (payload IS NULL AND terminal = 0 AND retryAt <= ?))
     RETURNING attempts`,
    [token, now + 120_000, id, now, fresh, now],
  );
  return row ? { token, attempts: row.attempts } : null;
}

export async function finishMatch(id: string, token: string, raw: HDMatch) {
  const payload = archivePayload(raw, id);
  return queryOne<{ matchId: string }>(
    `UPDATE MatchArchive SET payload = ?, fetchedAt = ?, leaseToken = NULL, leaseUntil = 0,
       retryAt = 0, terminal = 0, lastStatus = 200
     WHERE matchId = ? AND leaseToken = ? RETURNING matchId`, [payload, Date.now(), id, token],
  );
}

export async function failMatch(id: string, token: string, attempts: number, error: unknown, now = Date.now()) {
  const status = error instanceof HenrikDevError ? error.status : 503;
  const rateLimited = status === 429;
  const terminal = !rateLimited && ([400, 401, 403, 404, 410].includes(status) || attempts >= 5);
  const delay = rateLimited && error instanceof HenrikDevError
    ? error.retryAfter * 1000 : Math.min(3_600_000, 30_000 * 2 ** Math.min(attempts - 1, 7));
  await execute(
    `UPDATE MatchArchive SET leaseToken = NULL, leaseUntil = 0, retryAt = ?,
       terminal = ?, lastStatus = ?, attempts = max(0, attempts - ?)
     WHERE matchId = ? AND leaseToken = ?`,
    [now + delay, terminal, status, rateLimited ? 1 : 0, id, token],
  );
}

export function archivedMatch(id: string, fetcher: () => Promise<HDMatch>, fresh = false): Promise<HDMatch> {
  if (!MATCH_ID.test(id)) return Promise.reject(new HenrikDevError(400, "Invalid match ID"));
  const existing = pending.get(id);
  if (existing) return existing;
  const task = (async () => {
    if (!fresh) {
      const hit = await readArchivedMatch(id);
      if (hit) return hit;
    }
    const claim = await claimMatch(id, Date.now(), fresh);
    if (!claim) {
      const hit = !fresh && await readArchivedMatch(id);
      if (hit) return hit;
      const state = await queryOne<ArchiveRow>("SELECT * FROM MatchArchive WHERE matchId = ?", [id]);
      throw new HenrikDevError(state?.terminal ? state.lastStatus ?? 503 : 429, "Match pending or unavailable",
        Math.max(1, Math.ceil(((state?.retryAt || Date.now() + 1000) - Date.now()) / 1000)));
    }
    try {
      const raw = await fetcher();
      await finishMatch(id, claim.token, raw);
      return raw;
    } catch (error) {
      await failMatch(id, claim.token, claim.attempts, error);
      throw error;
    }
  })().finally(() => pending.delete(id));
  pending.set(id, task);
  return task;
}
