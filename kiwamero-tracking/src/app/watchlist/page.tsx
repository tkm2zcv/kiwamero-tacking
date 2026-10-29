import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDict } from "@/lib/i18n/server";
import { Eye, Trash2 } from "lucide-react";
import { WatchlistRemoveButton } from "@/components/watchlist-remove";
import { WatchlistWebhook } from "@/components/watchlist-webhook";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const t = await getDict();
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  if (!session) {
    return (
      <div className="kt-container flex min-h-[50vh] items-center justify-center">
        <div className="trn-card max-w-sm p-8 text-center">
          <Eye className="mx-auto size-8 text-tertiary" />
          <p className="mt-4 text-secondary">{t.watchlist.signInCta}</p>
          <Link href="/login" className="trn-button trn-button--action mt-6 h-11 w-full">
            {t.nav.signIn}
          </Link>
        </div>
      </div>
    );
  }

  const entries = await prisma.watchlistEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="kt-container py-8" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
      <h1 style={{ fontFamily: "var(--kt-title)", fontSize: 28, margin: 0 }}>{t.watchlist.title}</h1>

      <WatchlistWebhook />

      {!entries.length ? (
        <p className="text-secondary">{t.watchlist.empty}</p>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => (
            <div key={e.id} className="trn-card flex flex-wrap items-center gap-4 p-4">
              <div className="flex-1 font-bold">
                {e.riotName}
                <span className="text-tertiary">#{e.riotTag}</span>
                <div className="mt-1 text-xs" style={{ color: "var(--kt-text-2)" }}>
                  {e.region ? `${e.region.toUpperCase()} · ` : ""}
                  {e.lastNotifiedAt
                    ? `last alert ${new Date(e.lastNotifiedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
                    : "no alert yet"}
                </div>
              </div>
              <Link
                href={`/valorant/profile/riot/${encodeURIComponent(`${e.riotName}#${e.riotTag}`)}/overview`}
                className="trn-button h-9 px-4 text-xs"
              >
                {t.watchlist.viewProfile}
              </Link>
              <WatchlistRemoveButton name={e.riotName} tag={e.riotTag} label={t.watchlist.remove} icon={<Trash2 className="size-4" />} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
