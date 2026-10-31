import { NextRequest, NextResponse } from "next/server";
import { ownerUserId } from "@/lib/owner-access";
import { execute, queryAll } from "@/lib/db";
import type { WatchlistEntryRow } from "@/lib/db-schema";
import { getAccount } from "@/lib/henrikdev";
import { MAX_WATCHED_PLAYERS, verifyWatchlistBinding } from "@/lib/watch-core";
import { upsertWatchlistEntry, watchedPlayerCount } from "@/lib/watch-db";

async function userId(req: NextRequest) {
  return ownerUserId(req.headers);
}

export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
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
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null) ?? {}) as {
    riotName?: unknown;
    riotTag?: unknown;
    puuid?: unknown;
    region?: unknown;
  };
  const riotName = typeof body.riotName === "string" ? body.riotName.trim() : "";
  const riotTag = typeof body.riotTag === "string" ? body.riotTag.trim() : "";
  const puuid = typeof body.puuid === "string" ? body.puuid.trim() : undefined;
  const region = typeof body.region === "string" ? body.region.trim().toUpperCase() : undefined;
  if (!riotName || riotName.length > 100 || !riotTag || riotTag.length > 20 ||
      (puuid != null && !/^[a-zA-Z0-9-]{20,64}$/.test(puuid)) ||
      (region != null && !/^[A-Z0-9]{2,16}$/.test(region))) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  // The shared watch cycle fetches once per player using the earliest entry's
  // stored puuid, so caller-supplied values must provably belong to the
  // claimed riotName#riotTag. When neither is supplied the cycle resolves
  // canonically instead, so no upstream call is made here.
  let verified: { puuid: string; region: string } | null = null;
  if (puuid != null || region != null) {
    verified = await verifyWatchlistBinding(riotName, riotTag, puuid, getAccount);
    if (!verified) {
      return NextResponse.json(
        { error: "puuid_mismatch", message: "puuid does not match this player." },
        { status: 400 },
      );
    }
  }
  const entry = await upsertWatchlistEntry({
    userId: uid, riotName, riotTag,
    puuid: verified ? verified.puuid : puuid,
    region: verified ? verified.region : region,
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
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { riotName?: unknown; riotTag?: unknown };
  const riotName = typeof body.riotName === "string" ? body.riotName.trim() : "";
  const riotTag = typeof body.riotTag === "string" ? body.riotTag.trim() : "";
  if (!riotName || !riotTag) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await execute(`DELETE FROM "WatchlistEntry" WHERE "userId" = ? AND "riotName" = ? AND "riotTag" = ?`, [
    uid,
    riotName,
    riotTag,
  ]);
  return NextResponse.json({ ok: true });
}
