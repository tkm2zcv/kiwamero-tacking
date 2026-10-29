import { execute, queryAll } from "./db.ts";
import type { WatchDb, WatchEntryRow } from "./watch-core";

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
         ORDER BY e."createdAt" ASC
         LIMIT ?`,
        [...(where?.userId ? [where.userId] : []), take ?? 10_000],
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
