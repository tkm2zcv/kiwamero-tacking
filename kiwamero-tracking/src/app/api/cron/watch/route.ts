import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWatchDeps, runWatchCycle, type WatchDb } from "@/lib/watch-run";

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
 * Hourly watch cycle. Triggered by the Worker scheduled handler (see src/worker.ts)
 * or manually with `Authorization: Bearer $CRON_SECRET`.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.HENRIK_API_KEY) {
    return NextResponse.json({ error: "HENRIK_API_KEY is not configured" }, { status: 503 });
  }

  try {
    const summary = await runWatchCycle(prisma as unknown as WatchDb, createWatchDeps());
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    // Prisma 7 ships its query compiler as WebAssembly and compiles it at runtime.
    // workerd rejects dynamic Wasm compilation, so Prisma cannot run on Workers yet.
    // See docs/system-architecture.md ("Prisma on Workers" gate).
    if (/Wasm code generation|WebAssembly/i.test(message)) {
      console.error("watch cycle: Prisma cannot run in this runtime", message);
      return NextResponse.json(
        {
          error: "runtime_unsupported",
          message:
            "Prisma 7's WebAssembly query compiler cannot be instantiated inside workerd. Run the cycle on Node (next dev / server) until the data layer is migrated to D1-native queries.",
        },
        { status: 503 },
      );
    }
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
