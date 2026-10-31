import Link from "next/link";
import { headers } from "next/headers";
import { queryAll } from "@/lib/db";
import type { WatchlistEntryRow } from "@/lib/db-schema";
import { getDict } from "@/lib/i18n/server";
import { getSiteAccess } from "@/lib/site-access";
import { AccessGate } from "@/components/access-gate";
import { Eye, Trash2 } from "lucide-react";
import { WatchlistRemoveButton } from "@/components/watchlist-remove";
import { WatchlistWebhook } from "@/components/watchlist-webhook";
import { MAX_WATCHED_PLAYERS } from "@/lib/watch-core";
import { watchedPlayerCount } from "@/lib/watch-db";

export const metadata = { title: "Watchlist" };

export default async function WatchlistPage() {
  const access = await getSiteAccess(await headers());
  if (access.status !== "allowed") return <AccessGate status={access.status} />;
  const t = await getDict();

  const [entries, systemWatched] = await Promise.all([
    queryAll<WatchlistEntryRow>(
      `SELECT * FROM "WatchlistEntry" WHERE "userId" = ? ORDER BY "createdAt" DESC`,
      [access.userId],
    ),
    watchedPlayerCount(),
  ]);

  return (
    <div className="kt-container py-8" style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000 }}>
      <div className="kt-watch-head">
        <div>
          <h1 style={{ fontFamily: "var(--kt-title)", fontSize: 28, margin: 0 }}>{t.watchlist.title}</h1>
          <p className="kt-watch-sub">
            {entries.length} {entries.length === 1 ? "player" : "players"} watched · system capacity {systemWatched}/{MAX_WATCHED_PLAYERS}
          </p>
        </div>
      </div>

      <WatchlistWebhook />

      {!entries.length ? (
        <p className="text-secondary">{t.watchlist.empty}</p>
      ) : (
        <div className="grid gap-2">
          {entries.map((e) => (
            <div key={e.id} className="trn-card kt-watch-row">
              <div className="kt-watch-status" aria-hidden="true">
                <Eye size={18} />
              </div>
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
