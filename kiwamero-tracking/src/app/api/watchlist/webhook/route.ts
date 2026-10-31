import { NextRequest, NextResponse } from "next/server";
import { ownerUserId } from "@/lib/owner-access";
import { execute, queryOne } from "@/lib/db";
import { normalizeDiscordWebhook, redactWebhook } from "@/lib/watch-core";
import { createWatchDeps, runWatchCycle } from "@/lib/watch-run";
import { watchDb } from "@/lib/watch-db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function userId(req: NextRequest) {
  return ownerUserId(req.headers);
}

/** Current webhook status (never returns the secret URL). */
export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const user = await queryOne<{ webhookUrl: string | null; webhookUpdatedAt: string | null }>(
    `SELECT "webhookUrl", "webhookUpdatedAt" FROM "User" WHERE "id" = ?`,
    [uid],
  );
  return NextResponse.json({
    configured: Boolean(user?.webhookUrl),
    masked: user?.webhookUrl ? redactWebhook(user.webhookUrl) : null,
    updatedAt: user?.webhookUpdatedAt ?? null,
  });
}

/**
 * Save the Discord webhook and immediately push the most recent match of each
 * watched player (product rule: notify right after registration).
 */
export async function POST(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const normalized = normalizeDiscordWebhook(body.url ?? "");
  if (!normalized) {
    return NextResponse.json(
      { error: "invalid_webhook", message: "Only https://discord.com/api/webhooks/<id>/<token> is accepted." },
      { status: 400 },
    );
  }

  await execute(`UPDATE "User" SET "webhookUrl" = ?, "webhookUpdatedAt" = ? WHERE "id" = ?`, [
    normalized,
    new Date(),
    uid,
  ]);

  let delivery: Awaited<ReturnType<typeof runWatchCycle>> | null = null;
  if (process.env.HENRIK_API_KEY) {
    delivery = await runWatchCycle(watchDb, createWatchDeps(), {
      userId: uid,
      maxPlayers: 5,
    }).catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    masked: redactWebhook(normalized),
    delivered: delivery?.matchesSent ?? 0,
  });
}

export async function DELETE(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await execute(`UPDATE "User" SET "webhookUrl" = NULL, "webhookUpdatedAt" = ? WHERE "id" = ?`, [
    new Date(),
    uid,
  ]);
  return NextResponse.json({ ok: true });
}
