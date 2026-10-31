import { NextRequest, NextResponse } from "next/server";
import { ownerUserId } from "@/lib/owner-access";
import { queryOne } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Send a harmless test message so users can verify the webhook themselves. */
export async function POST(req: NextRequest) {
  const uid = await ownerUserId(req.headers);
  if (!uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const user = await queryOne<{ webhookUrl: string | null }>(
    `SELECT "webhookUrl" FROM "User" WHERE "id" = ?`,
    [uid],
  );
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
