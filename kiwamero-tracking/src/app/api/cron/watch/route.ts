import { NextRequest, NextResponse } from "next/server";
import { createWatchDeps, runWatchCycle } from "@/lib/watch-run";
import { watchDb } from "@/lib/watch-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : req.headers.get("x-cron-secret") ?? "";
  if (!secret) return process.env.NODE_ENV === "development";
  return token.length > 0 && token === secret;
}

/**
 * Hourly watch cycle. Triggered by the Worker scheduled handler (see
 * src/worker.js) or manually with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.HENRIK_API_KEY) {
    return NextResponse.json({ error: "HENRIK_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const summary = await runWatchCycle(watchDb, createWatchDeps());
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("watch cycle failed", e);
    return NextResponse.json({ error: "watch cycle failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Health probe for uptime checks; no side effects.
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    configured: Boolean(process.env.HENRIK_API_KEY),
    secretConfigured: Boolean(process.env.CRON_SECRET),
  });
}
