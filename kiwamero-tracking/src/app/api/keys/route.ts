import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ownerUserId } from "@/lib/owner-access";

export async function POST(req: NextRequest) {
  const userId = await ownerUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const key = `kt_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  await prisma.apiKey.create({ data: { userId, key: `sha256:${hash}` } });
  return NextResponse.json({ key });
}

export async function GET(req: NextRequest) {
  const userId = await ownerUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const keys = await prisma.apiKey.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, label: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ keys });
}

export async function DELETE(req: NextRequest) {
  const userId = await ownerUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "invalid key id" }, { status: 400 });
  }
  await prisma.apiKey.updateMany({
    where: { id: body.id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
