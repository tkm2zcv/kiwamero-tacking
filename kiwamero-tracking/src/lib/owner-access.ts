import "server-only";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";

export interface OwnerAccess {
  /** Better Auth user id — set for session auth, null for API-key auth. */
  userId: string | null;
  /** Stable rate-limit key for the credential. */
  rateLimitKey: string;
}

interface SessionLike {
  user: { id: string };
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function ownerDiscordIds(): string[] {
  return (process.env.OWNER_DISCORD_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Resolve an allowlisted Discord-linked Better Auth session.
 * API keys are intentionally not accepted here; this is the human-site check.
 */
export async function allowedDiscordAccess(
  session: SessionLike | null,
): Promise<(OwnerAccess & { discordId: string }) | null> {
  if (!session) return null;
  const ids = ownerDiscordIds();
  if (!ids.length) return null;
  const linked = await queryOne<{ accountId: string }>(
    `SELECT "accountId" FROM "Account"
     WHERE "userId" = ? AND "providerId" = 'discord'
       AND "accountId" IN (${ids.map(() => "?").join(",")})`,
    [session.user.id, ...ids],
  );
  return linked
    ? { userId: session.user.id, discordId: linked.accountId, rateLimitKey: `user:${session.user.id}` }
    : null;
}

/**
 * Resolve the owner credential: either a Discord session whose linked Discord
 * account id is in OWNER_DISCORD_IDS, or a valid `kt_` API key (hash lookup).
 */
export async function resolveOwnerAccess(headers: Headers): Promise<OwnerAccess | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const discordAccess = await allowedDiscordAccess(session);
  if (discordAccess) {
    return { userId: discordAccess.userId, rateLimitKey: discordAccess.rateLimitKey };
  }

  const key = headers.get("authorization")?.match(/^Bearer (kt_[0-9a-f]{64})$/)?.[1];
  if (!key) return null;
  const hash = await sha256Hex(key);
  const found = await queryOne<{ id: string }>(
    `SELECT "id" FROM "ApiKey" WHERE "key" = ? AND "revokedAt" IS NULL`,
    [`sha256:${hash}`],
  );
  return found ? { userId: null, rateLimitKey: `key:${hash.slice(0, 16)}` } : null;
}

export async function ownerUserId(headers: Headers): Promise<string | null> {
  return (await resolveOwnerAccess(headers))?.userId ?? null;
}

export async function hasOwnerAccess(headers: Headers): Promise<boolean> {
  return (await resolveOwnerAccess(headers)) !== null;
}
