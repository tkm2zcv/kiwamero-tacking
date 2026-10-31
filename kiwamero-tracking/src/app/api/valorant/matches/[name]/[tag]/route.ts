import { NextRequest, NextResponse } from "next/server";
import { getAccount, getMatches } from "@/lib/henrikdev";
import { resolveOwnerAccess } from "@/lib/owner-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { sameSiteInitiator } from "@/lib/fetch-metadata";

const MATCH_MODES = new Set([
  "competitive", "premier", "unrated", "deathmatch", "swiftplay",
  "teamdeathmatch", "spikerush", "escalation", "replication",
]);

export async function GET(req: NextRequest, ctx: { params: Promise<{ name: string; tag: string }> }) {
  if (!sameSiteInitiator(req.headers)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const access = await resolveOwnerAccess(req.headers);
  if (!access) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const rate = checkRateLimit(access.rateLimitKey);
  if (!rate.ok) return rateLimitResponse(rate);
  const { name, tag } = await ctx.params;
  try {
    const acc = await getAccount(name, tag);
    const rawMode = req.nextUrl.searchParams.get("mode");
    const mode = rawMode && MATCH_MODES.has(rawMode) ? rawMode : undefined;
    const size = Math.max(1, Math.min(30, Number(req.nextUrl.searchParams.get("size")) || 10));
    const data = await getMatches(acc.region, acc.puuid, { mode, size });
    return NextResponse.json({ status: 200, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("Matches lookup failed", e);
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
