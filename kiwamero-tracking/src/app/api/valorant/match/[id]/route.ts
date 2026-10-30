import { NextRequest, NextResponse } from "next/server";
import { getMatch } from "@/lib/henrikdev";
import { normalizeHDMatch } from "@/lib/match-normalize";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

/**
 * Public match-detail lookup powering the match-list expand drawer.
 * Anonymous (profile pages are public); the data is public match data and
 * upstream responses are cached long-term since finished matches are immutable.
 * Rate-limited per client IP like the rest of the public surface.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "anon";
  const rate = checkRateLimit(`match-detail:${ip}`);
  if (!rate.ok) return rateLimitResponse(rate);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{30,40}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_match_id" }, { status: 400 });
  }
  try {
    const match = normalizeHDMatch(await getMatch(id));
    return NextResponse.json(match);
  } catch {
    return NextResponse.json({ error: "match_unavailable" }, { status: 404 });
  }
}
