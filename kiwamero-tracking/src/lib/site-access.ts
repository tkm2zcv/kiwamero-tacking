import "server-only";
import { auth } from "@/lib/auth";
import { allowedDiscordAccess } from "@/lib/owner-access";

export type SiteAccessStatus = "anonymous" | "denied" | "allowed";

export type SiteAccess =
  | { status: "anonymous"; userId: null }
  | { status: "denied"; userId: string }
  | { status: "allowed"; userId: string };

/** Human-site gate: a Discord session is allowed only when its Discord ID is allowlisted. */
export async function getSiteAccess(headers: Headers): Promise<SiteAccess> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session) return { status: "anonymous", userId: null };
  const access = await allowedDiscordAccess(session).catch(() => null);
  return access
    ? { status: "allowed", userId: session.user.id }
    : { status: "denied", userId: session.user.id };
}
