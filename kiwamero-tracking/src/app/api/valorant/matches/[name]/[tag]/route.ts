import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMatches } from "@/lib/henrikdev";
import { hasOwnerAccess } from "@/lib/owner-access";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; tag: string }> }) {
  if (!(await hasOwnerAccess(req.headers))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { name, tag } = await ctx.params;
  try {
    const acc = await getAccount(name, tag);
    const mode = req.nextUrl.searchParams.get("mode") ?? undefined;
    const size = Number(req.nextUrl.searchParams.get("size") ?? 10);
    const data = await getMatches(acc.region, acc.puuid, { mode, size });
    return NextResponse.json({ status: 200, data });
  } catch (e) {
    return NextResponse.json({ status: 500, error: String(e) }, { status: 500 });
  }
}
