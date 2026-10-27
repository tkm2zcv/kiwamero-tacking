import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  });
  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { riotName, riotTag, puuid } = await req.json();
  if (!riotName || !riotTag) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const entry = await prisma.watchlistEntry.upsert({
    where: { userId_riotName_riotTag: { userId: uid, riotName, riotTag } },
    create: { userId: uid, riotName, riotTag, puuid },
    update: {},
  });
  return NextResponse.json({ entry });
}

export async function DELETE(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { riotName, riotTag } = await req.json();
  await prisma.watchlistEntry.deleteMany({ where: { userId: uid, riotName, riotTag } });
  return NextResponse.json({ ok: true });
}
