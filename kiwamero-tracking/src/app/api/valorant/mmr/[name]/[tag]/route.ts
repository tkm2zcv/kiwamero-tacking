import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMmr } from "@/lib/henrikdev";
import { hasOwnerAccess } from "@/lib/owner-access";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; tag: string }> }) {
  if (!(await hasOwnerAccess(req.headers))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { name, tag } = await ctx.params;
  try {
    const acc = await getAccount(name, tag);
    return NextResponse.json({ status: 200, data: await getMmr(acc.region, acc.puuid) });
  } catch (e) {
    console.error("MMR lookup failed", e);
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
