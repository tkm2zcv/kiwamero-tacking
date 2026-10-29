import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Send a harmless test message so users can verify the webhook themselves. */
export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const uid = session?.user?.id;
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { webhookUrl: true } });
  if (!user?.webhookUrl) {
    return NextResponse.json({ error: "no_webhook", message: "Save a webhook URL first." }, { status: 400 });
  }

  const res = await fetch(user.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: "Kiwamero Tracking — test notification",
          description: "This channel will receive a message when a watched player finishes a match.",
          color: 0xff4655,
          timestamp: new Date().toISOString(),
          footer: { text: "Kiwamero Tracking" },
        },
      ],
      allowed_mentions: { parse: [] },
    }),
  }).catch(() => null);

  if (!res?.ok) {
    return NextResponse.json({ error: "delivery_failed", status: res?.status ?? 0 }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
