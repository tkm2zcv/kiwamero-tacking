import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMmr } from "@/lib/henrikdev";
import { resolveOwnerAccess } from "@/lib/owner-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; tag: string }> }) {
  const access = await resolveOwnerAccess(req.headers);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rate = checkRateLimit(access.rateLimitKey);
  if (!rate.ok) return rateLimitResponse(rate);
  const { name, tag } = await ctx.params;
  try {
    const acc = await getAccount(name, tag);
    return NextResponse.json({ status: 200, data: await getMmr(acc.region, acc.puuid) });
  } catch (e) {
    console.error("MMR lookup failed", e);
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
