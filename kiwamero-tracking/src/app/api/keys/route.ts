import { NextRequest, NextResponse } from "next/server";
import { execute, queryAll } from "@/lib/db";
import type { ApiKeyRow } from "@/lib/db-schema";
import { ownerUserId } from "@/lib/owner-access";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

async function authorize(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const userId = await ownerUserId(req.headers);
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const rate = checkRateLimit(`user:${userId}`);
  if (!rate.ok) return rateLimitResponse(rate);
  return { userId };
}

export async function POST(req: NextRequest) {
  const auth = await authorize(req);
  if (auth instanceof NextResponse) return auth;
  const key = `kt_${Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  await execute(`INSERT INTO "ApiKey" ("id", "userId", "key", "createdAt") VALUES (?, ?, ?, ?)`, [
    crypto.randomUUID(),
    auth.userId,
    `sha256:${hash}`,
    new Date(),
  ]);
  return NextResponse.json({ key });
}

export async function GET(req: NextRequest) {
  const auth = await authorize(req);
  if (auth instanceof NextResponse) return auth;
  const keys = await queryAll<Pick<ApiKeyRow, "id" | "label" | "createdAt">>(
    `SELECT "id", "label", "createdAt" FROM "ApiKey"
     WHERE "userId" = ? AND "revokedAt" IS NULL ORDER BY "createdAt" DESC`,
    [auth.userId],
  );
  return NextResponse.json({ keys });
}

export async function DELETE(req: NextRequest) {
  const auth = await authorize(req);
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (typeof body?.id !== "string") {
    return NextResponse.json({ error: "invalid key id" }, { status: 400 });
  }
  await execute(`UPDATE "ApiKey" SET "revokedAt" = ? WHERE "id" = ? AND "userId" = ? AND "revokedAt" IS NULL`, [
    new Date(),
    body.id,
    auth.userId,
  ]);
  return NextResponse.json({ ok: true });
}
