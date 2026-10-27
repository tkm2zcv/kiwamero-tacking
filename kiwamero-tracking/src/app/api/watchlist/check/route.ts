import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ watching: false });
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const tag = req.nextUrl.searchParams.get("tag") ?? "";
  const found = await prisma.watchlistEntry.findFirst({
    where: { userId: session.user.id, riotName: name, riotTag: tag },
  });
  return NextResponse.json({ watching: !!found });
}
