import "server-only";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function ownerUserId(headers: Headers): Promise<string | null> {
  const ids = (process.env.OWNER_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  if (!ids.length) return null;

  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session) return null;
  const linked = await prisma.account.findFirst({
    where: { userId: session.user.id, providerId: "discord", accountId: { in: ids } },
    select: { id: true },
  });
  return linked ? session.user.id : null;
}

export async function hasOwnerAccess(headers: Headers): Promise<boolean> {
  if (await ownerUserId(headers)) return true;
  const key = headers.get("authorization")?.match(/^Bearer (kt_[0-9a-f]{64})$/)?.[1];
  if (!key) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const found = await prisma.apiKey.findFirst({
    where: { key: `sha256:${hash}`, revokedAt: null },
    select: { id: true },
  });
  return !!found;
}
