import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MAX_WATCHED_PLAYERS, playerKey } from "@/lib/watch-core";

async function userId(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ entries: [] });
  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      riotName: true,
      riotTag: true,
      puuid: true,
      region: true,
      createdAt: true,
      lastNotifiedAt: true,
    },
  });
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
  const all = await prisma.watchlistEntry.findMany({ select: { riotName: true, riotTag: true } });
  const distinct = new Set(all.map((e: { riotName: string; riotTag: string }) => playerKey(e.riotName, e.riotTag)));
  if (!distinct.has(playerKey(riotName, riotTag)) && distinct.size >= MAX_WATCHED_PLAYERS) {
    return NextResponse.json(
      { error: "watchlist_full", message: `Monitoring is limited to ${MAX_WATCHED_PLAYERS} players system-wide.` },
      { status: 409 },
    );
  }

  const entry = await prisma.watchlistEntry.upsert({
    where: { userId_riotName_riotTag: { userId: uid, riotName, riotTag } },
    create: { userId: uid, riotName, riotTag, puuid: puuid ?? null, region: region ?? null },
    update: { puuid: puuid ?? undefined, region: region ?? undefined },
  });
  return NextResponse.json({ entry, players: distinct.size });
}

export async function DELETE(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { riotName, riotTag } = (await req.json().catch(() => ({}))) as { riotName?: string; riotTag?: string };
  if (!riotName || !riotTag) return NextResponse.json({ error: "bad request" }, { status: 400 });
  await prisma.watchlistEntry.deleteMany({ where: { userId: uid, riotName, riotTag } });
  return NextResponse.json({ ok: true });
}
