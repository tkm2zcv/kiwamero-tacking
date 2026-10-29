import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { execute, queryAll } from "@/lib/db";
import type { WatchlistEntryRow } from "@/lib/db-schema";
import { MAX_WATCHED_PLAYERS, playerKey } from "@/lib/watch-core";

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
  const { riotName, riotTag, puuid, region } = (await req.json().catch(() => ({}))) as {
    riotName?: string;
    riotTag?: string;
    puuid?: string;
    region?: string;
  };
  if (!riotName || !riotTag) return NextResponse.json({ error: "bad request" }, { status: 400 });

  // System-wide cap on distinct watched players (shared queries).
  const all = await queryAll<Pick<WatchlistEntryRow, "riotName" | "riotTag">>(
    `SELECT "riotName", "riotTag" FROM "WatchlistEntry"`,
  );
  const distinct = new Set(all.map((e) => playerKey(e.riotName, e.riotTag)));
  if (!distinct.has(playerKey(riotName, riotTag)) && distinct.size >= MAX_WATCHED_PLAYERS) {
    return NextResponse.json(
      { error: "watchlist_full", message: `Monitoring is limited to ${MAX_WATCHED_PLAYERS} players system-wide.` },
      { status: 409 },
    );
  }

  const rows = await queryAll<WatchlistEntryRow>(
    `INSERT INTO "WatchlistEntry" ("id", "userId", "riotName", "riotTag", "puuid", "region", "createdAt")
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT ("userId", "riotName", "riotTag")
     DO UPDATE SET "puuid" = excluded."puuid", "region" = excluded."region"
     RETURNING *`,
    [crypto.randomUUID(), uid, riotName, riotTag, puuid ?? null, region ?? null, new Date()],
  );
  return NextResponse.json({ entry: rows[0], players: distinct.size });
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
