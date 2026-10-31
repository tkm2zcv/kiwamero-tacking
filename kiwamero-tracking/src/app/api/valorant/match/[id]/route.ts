import { NextRequest, NextResponse } from "next/server";
import { getMatch } from "@/lib/henrikdev";
import { normalizeHDMatch } from "@/lib/match-normalize";
import { resolveOwnerAccess } from "@/lib/owner-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { HenrikDevError } from "@/lib/henrik-errors";

/** Match-detail lookup powering the match-list expand drawer. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const access = await resolveOwnerAccess(req.headers);
  if (!access) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rate = checkRateLimit(`match-detail:${access.rateLimitKey}`);
  if (!rate.ok) return rateLimitResponse(rate);
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{30,40}$/i.test(id)) {
    return NextResponse.json({ error: "invalid_match_id" }, { status: 400 });
  }
  try {
    const match = normalizeHDMatch(await getMatch(id));
    return NextResponse.json(match);
  } catch (error) {
    const status = error instanceof HenrikDevError ? error.status : 503;
    return NextResponse.json({ error: status === 429 ? "rate_limited" : "match_unavailable" }, {
      status, headers: status === 429 && error instanceof HenrikDevError
        ? { "Retry-After": String(error.retryAfter) } : {},
    });
  }
}
