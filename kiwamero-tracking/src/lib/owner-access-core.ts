/**
 * Pure owner-authorization helpers: the OWNER_DISCORD_IDS allowlist, the
 * session-side Discord check, the per-user ApiKey cap, and the `kt_` hash
 * lookup. No Next.js or auth imports so `node --test` can exercise the real
 * SQL; the Next-facing orchestration lives in `owner-access.ts`.
 */
import { queryAll, queryOne } from "./db.ts";

export interface OwnerAccess {
  /** Better Auth user id — set for session auth, null for API-key auth. */
  userId: string | null;
  /** Stable rate-limit key for the credential. */
  rateLimitKey: string;
}

interface SessionLike {
  user: { id: string };
}

/** Live (non-revoked) `kt_` keys an owner may hold at once (R: per-principal budget). */
export const MAX_API_KEYS_PER_USER = 10;

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

/** Number of non-revoked `kt_` keys the user currently holds. */
export async function liveApiKeyCount(userId: string): Promise<number> {
  const [row] = await queryAll<{ count: number }>(
    `SELECT count(*) AS count FROM "ApiKey" WHERE "userId" = ? AND "revokedAt" IS NULL`,
    [userId],
  );
  return row?.count ?? 0;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve a `kt_` API key by sha256 hash. A key authorizes only while its
 * issuer remains an allowlisted owner: removing the issuer's Discord id from
 * OWNER_DISCORD_IDS (or deleting their Account row) denies every key they
 * minted. Rate limiting stays keyed per credential (`key:<hash16>`).
 */
export async function resolveApiKeyAccess(headers: Headers): Promise<OwnerAccess | null> {
  const key = headers.get("authorization")?.match(/^Bearer (kt_[0-9a-f]{64})$/)?.[1];
  if (!key) return null;
  const ids = ownerDiscordIds();
  if (!ids.length) return null;
  const hash = await sha256Hex(key);
  const found = await queryOne<{ id: string }>(
    `SELECT k."id" FROM "ApiKey" k
     WHERE k."key" = ? AND k."revokedAt" IS NULL
       AND EXISTS (
         SELECT 1 FROM "Account" a
         WHERE a."userId" = k."userId" AND a."providerId" = 'discord'
           AND a."accountId" IN (${ids.map(() => "?").join(",")})
       )`,
    [`sha256:${hash}`, ...ids],
  );
  return found ? { userId: null, rateLimitKey: `key:${hash.slice(0, 16)}` } : null;
}
