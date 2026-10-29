import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) return NextResponse.json({ watching: false });
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const tag = req.nextUrl.searchParams.get("tag") ?? "";
  const found = await queryOne<{ id: string }>(
    `SELECT "id" FROM "WatchlistEntry" WHERE "userId" = ? AND "riotName" = ? AND "riotTag" = ? LIMIT 1`,
    [session.user.id, name, tag],
  );
  return NextResponse.json({ watching: !!found });
}
