import { NextRequest, NextResponse } from "next/server";
import { ownerUserId } from "@/lib/owner-access";
import { queryOne } from "@/lib/db";

export async function GET(req: NextRequest) {
  const uid = await ownerUserId(req.headers);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const tag = req.nextUrl.searchParams.get("tag") ?? "";
  const found = await queryOne<{ id: string }>(
    `SELECT "id" FROM "WatchlistEntry" WHERE "userId" = ? AND "riotName" = ? AND "riotTag" = ? LIMIT 1`,
    [uid, name, tag],
  );
  return NextResponse.json({ watching: !!found });
}
