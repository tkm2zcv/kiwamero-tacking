import type { NextRequest } from "next/server";
import { auditCoverage, enqueueAudit } from "@/lib/audit-history";
import { getAccount, getStoredMatches } from "@/lib/henrikdev";
import { HenrikDevError } from "@/lib/henrik-errors";
import { apiKeys } from "@/lib/henrik-client";
import { normalizeStoredMatch } from "@/lib/stored-stats";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { MATCH_ID } from "@/lib/match-archive";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ puuid: string }> };
const json = (data: unknown, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});

async function smallBody(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new HenrikDevError(400, "Missing request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2048) { await reader.cancel(); throw new HenrikDevError(413, "Request too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as { name?: unknown; tag?: unknown }; }
  catch { throw new HenrikDevError(400, "Invalid request"); }
}

export async function GET(_req: NextRequest, ctx: Context) {
  const { puuid } = await ctx.params;
  if (!MATCH_ID.test(puuid)) return json({ error: "invalid_player" }, 400);
  try { return json(await auditCoverage(puuid)); }
  catch { return json({ error: "analysis_storage_unavailable" }, 503); }
}

export async function POST(req: NextRequest, ctx: Context) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return json({ error: "invalid_origin" }, 403);
  const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "local";
  const rate = checkRateLimit(`audit-start:${ip}`, 3);
  if (!rate.ok) return rateLimitResponse(rate);
  const { puuid } = await ctx.params;
  if (!MATCH_ID.test(puuid)) return json({ error: "invalid_player" }, 400);
  if (!apiKeys().length) return json({ error: "upstream_not_configured" }, 503);
  try {
    const { name, tag } = await smallBody(req);
    if (typeof name !== "string" || typeof tag !== "string" ||
      !name.trim() || !tag.trim() || name.length > 64 || tag.length > 16) {
      return json({ error: "invalid_riot_id" }, 400);
    }
    const account = await getAccount(name, tag);
    if (account.puuid !== puuid) return json({ error: "player_mismatch" }, 409);
    const stored = await getStoredMatches(account.region, account.puuid, { mode: "competitive" });
    return json(await enqueueAudit({
      puuid: account.puuid, name: account.name, tag: account.tag, region: account.region,
      rows: stored.map(normalizeStoredMatch),
    }), 202);
  } catch (error) {
    if (error instanceof HenrikDevError) return Response.json(
      { error: "analysis_unavailable", status: error.status, retryAfter: error.retryAfter },
      { status: error.status, headers: { "Retry-After": String(error.retryAfter), "Cache-Control": "no-store" } },
    );
    return json({ error: "analysis_storage_unavailable" }, 503);
  }
}
