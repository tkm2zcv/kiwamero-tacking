import { NextRequest, NextResponse } from "next/server";
import { createWatchDeps, runWatchCycle } from "@/lib/watch-run";
import { watchDb } from "@/lib/watch-db";
import { apiKeys } from "@/lib/henrik-client";
import { cronAuthorized as authorized } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Hourly watch cycle. Triggered by the Worker scheduled handler (see
 * src/worker.js) or manually with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!apiKeys().length) {
    return NextResponse.json({ error: "HenrikDev keys are not configured" }, { status: 503 });
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
    configured: apiKeys().length > 0,
    secretConfigured: Boolean(process.env.CRON_SECRET),
  });
}
