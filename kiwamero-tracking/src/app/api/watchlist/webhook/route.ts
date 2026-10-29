import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeDiscordWebhook, redactWebhook } from "@/lib/watch-core";
import { createWatchDeps, runWatchCycle, type WatchDb } from "@/lib/watch-run";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function userId(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  return session?.user?.id ?? null;
}

/** Current webhook status (never returns the secret URL). */
export async function GET(req: NextRequest) {
  const uid = await userId(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { webhookUrl: true, webhookUpdatedAt: true },
  });
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
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { url?: string };
  const normalized = normalizeDiscordWebhook(body.url ?? "");
  if (!normalized) {
    return NextResponse.json(
      { error: "invalid_webhook", message: "Only https://discord.com/api/webhooks/<id>/<token> is accepted." },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: uid },
    data: { webhookUrl: normalized, webhookUpdatedAt: new Date() },
  });

  let delivery: Awaited<ReturnType<typeof runWatchCycle>> | null = null;
  if (process.env.HENRIK_API_KEY) {
    delivery = await runWatchCycle(prisma as unknown as WatchDb, createWatchDeps(), {
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
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await prisma.user.update({
    where: { id: uid },
    data: { webhookUrl: null, webhookUpdatedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
