import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { execute, queryAll } from "@/lib/db";
import type { WatchlistEntryRow } from "@/lib/db-schema";
import { MAX_WATCHED_PLAYERS } from "@/lib/watch-core";
import { upsertWatchlistEntry, watchedPlayerCount } from "@/lib/watch-db";

async function userId(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ entries: [] });
  const entries = await queryAll<
    Pick<
      WatchlistEntryRow,
      "id" | "riotName" | "riotTag" | "puuid" | "region" | "createdAt" | "lastNotifiedAt"
    >
  >(
    `SELECT "id", "riotName", "riotTag", "puuid", "region", "createdAt", "lastNotifiedAt"
     FROM "WatchlistEntry" WHERE "userId" = ? ORDER BY "createdAt" DESC`,
    [uid],
  );
  return NextResponse.json({ entries, limit: MAX_WATCHED_PLAYERS });
}

export async function POST(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { riotName, riotTag, puuid, region } = (await req.json().catch(() => null) ?? {}) as {
    riotName?: string;
    riotTag?: string;
    puuid?: string;
    region?: string;
  };
  if (typeof riotName !== "string" || !riotName.trim() || riotName.length > 100 ||
      typeof riotTag !== "string" || !riotTag.trim() || riotTag.length > 20 ||
      (puuid != null && typeof puuid !== "string") || (region != null && typeof region !== "string")) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const entry = await upsertWatchlistEntry({
    userId: uid, riotName: riotName.trim(), riotTag: riotTag.trim(), puuid, region,
  });
  if (!entry) {
    return NextResponse.json(
      { error: "watchlist_full", message: `Monitoring is limited to ${MAX_WATCHED_PLAYERS} players system-wide.` },
      { status: 409 },
    );
  }

  return NextResponse.json({ entry, players: await watchedPlayerCount() });
}

export async function DELETE(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { riotName, riotTag } = (await req.json().catch(() => ({}))) as { riotName?: string; riotTag?: string };
  if (!riotName || !riotTag) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await execute(`DELETE FROM "WatchlistEntry" WHERE "userId" = ? AND "riotName" = ? AND "riotTag" = ?`, [
    uid,
    riotName,
    riotTag,
  ]);
  return NextResponse.json({ ok: true });
}
