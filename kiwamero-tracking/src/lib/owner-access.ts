import "server-only";
import { auth } from "@/lib/auth";
import { allowedDiscordAccess, resolveApiKeyAccess } from "./owner-access-core.ts";
import type { OwnerAccess } from "./owner-access-core.ts";

export { allowedDiscordAccess, ownerDiscordIds } from "./owner-access-core.ts";
export type { OwnerAccess } from "./owner-access-core.ts";

/**
 * Resolve the owner credential: either a Discord session whose linked Discord
 * account id is in OWNER_DISCORD_IDS, or a `kt_` API key whose issuer is still
 * allowlisted (hash lookup in owner-access-core.ts).
 */
export async function resolveOwnerAccess(headers: Headers): Promise<OwnerAccess | null> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const discordAccess = await allowedDiscordAccess(session);
  if (discordAccess) {
    return { userId: discordAccess.userId, rateLimitKey: discordAccess.rateLimitKey };
  }

  return resolveApiKeyAccess(headers);
}

export async function ownerUserId(headers: Headers): Promise<string | null> {
  return (await resolveOwnerAccess(headers))?.userId ?? null;
}

export async function hasOwnerAccess(headers: Headers): Promise<boolean> {
  return (await resolveOwnerAccess(headers)) !== null;
}
