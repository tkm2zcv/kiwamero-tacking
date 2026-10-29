import { execute, queryAll } from "./db.ts";
import { MAX_WATCHED_PLAYERS, type WatchDb, type WatchEntryRow } from "./watch-core.ts";
import type { WatchlistEntryRow } from "./db-schema";

interface WatchJoinRow {
  id: string;
  userId: string;
  riotName: string;
  riotTag: string;
  puuid: string | null;
  region: string | null;
  lastSeenGameStart: number | null;
  user_webhookUrl: string | null;
}

/**
 * `WatchDb` implementation over the raw-SQL backend (src/lib/db.ts). The
 * Prisma-shaped call signature is kept so `runWatchCycle` and its tests stay
 * unchanged — only the arguments watch-core actually passes are honored
 * (`where.userId` and `take`; the webhook join is baked into the query).
 */
export const watchDb: WatchDb = {
  watchlistEntry: {
    findMany: async (args) => {
      const { where, take } = (args ?? {}) as { where?: { userId?: string }; take?: number };
      const rows = await queryAll<WatchJoinRow>(
        `SELECT e."id", e."userId", e."riotName", e."riotTag", e."puuid", e."region",
                e."lastSeenGameStart", u."webhookUrl" AS "user_webhookUrl"
         FROM "WatchlistEntry" e
         JOIN "User" u ON u."id" = e."userId"
         WHERE u."webhookUrl" IS NOT NULL ${where?.userId ? `AND e."userId" = ?` : ""}
         ORDER BY e."createdAt" ASC ${take != null ? "LIMIT ?" : ""}`,
        [...(where?.userId ? [where.userId] : []), ...(take != null ? [take] : [])],
      );
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        riotName: r.riotName,
        riotTag: r.riotTag,
        puuid: r.puuid,
        region: r.region,
        lastSeenGameStart: r.lastSeenGameStart,
        user: { webhookUrl: r.user_webhookUrl },
      })) satisfies WatchEntryRow[];
    },
    update: async (args) => {
      const { where, data } = args as {
        where: { id: string };
        data: { lastSeenGameStart?: number; lastNotifiedMatchId?: string; lastNotifiedAt?: Date };
      };
      const sets: string[] = [];
      const params: unknown[] = [];
      if (data.lastSeenGameStart !== undefined) {
        sets.push(`"lastSeenGameStart" = ?`);
        params.push(data.lastSeenGameStart);
      }
      if (data.lastNotifiedMatchId !== undefined) {
        sets.push(`"lastNotifiedMatchId" = ?`);
        params.push(data.lastNotifiedMatchId);
      }
      if (data.lastNotifiedAt !== undefined) {
        sets.push(`"lastNotifiedAt" = ?`);
        params.push(data.lastNotifiedAt);
      }
      if (sets.length) {
        await execute(`UPDATE "WatchlistEntry" SET ${sets.join(", ")} WHERE "id" = ?`, [
          ...params,
          where.id,
        ]);
      }
      return null;
    },
  },
};

const distinctPlayersSql = `SELECT lower("riotName"), lower("riotTag")
  FROM "WatchlistEntry" GROUP BY lower("riotName"), lower("riotTag")`;

/** Admission and insert are one SQLite/D1 statement, so concurrent callers cannot oversubscribe. */
export async function upsertWatchlistEntry(input: {
  userId: string;
  riotName: string;
  riotTag: string;
  puuid?: string;
  region?: string;
}): Promise<WatchlistEntryRow | null> {
  const rows = await queryAll<WatchlistEntryRow>(
    `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag", "puuid", "region", "createdAt")
     SELECT ?, ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM "WatchlistEntry" WHERE lower("riotName") = lower(?) AND lower("riotTag") = lower(?)
     ) OR (SELECT count(*) FROM (${distinctPlayersSql})) < ?
     ON CONFLICT ("userId", "riotName", "riotTag")
     DO UPDATE SET "puuid" = excluded."puuid", "region" = excluded."region"
     RETURNING *`,
    [
      crypto.randomUUID(), input.userId, input.riotName, input.riotTag,
      input.puuid ?? null, input.region ?? null, new Date(),
      input.riotName, input.riotTag, MAX_WATCHED_PLAYERS,
    ],
  );
  return rows[0] ?? null;
}

export async function watchedPlayerCount(): Promise<number> {
  const [row] = await queryAll<{ count: number }>(`SELECT count(*) AS count FROM (${distinctPlayersSql})`);
  return row.count;
}
