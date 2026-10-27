import Image from "next/image";
import Link from "next/link";
import { RefreshCw, Share2 } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import { playerCardArt, tierIcon } from "@/lib/henrikdev";
import type { Profile } from "@/lib/types";
import { WatchlistButton } from "./watchlist-button";

const TABS = ["overview", "matches", "performance", "agents", "maps", "diagnosis"] as const;
export type ProfileTab = (typeof TABS)[number];

export async function ProfileHero({
  profile,
  activeTab,
  basePath,
}: {
  profile: Profile;
  activeTab: string;
  basePath: string;
}) {
  const t = await getDict();
  const banner = profile.cardId ? playerCardArt(profile.cardId) : null;

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: "var(--color-surface-1)" }}>
      {/* banner */}
      <div className="relative h-40 sm:h-48">
        {banner ? (
          <Image src={banner} alt="" fill className="object-cover object-center opacity-90" priority />
        ) : (
          <div className="h-full" style={{ background: "var(--color-surface-2)" }} />
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--color-surface-1) 8%, transparent 60%)" }}
        />
      </div>

      {/* identity row */}
      <div className="relative -mt-10 flex flex-col gap-4 px-6 pb-4 sm:flex-row sm:items-end">
        {banner ? (
          <Image
            src={playerCardArt(profile.cardId!, "smallart")}
            alt=""
            width={88}
            height={88}
            className="size-22 rounded-lg border-4"
            style={{ borderColor: "var(--color-surface-1)" }}
          />
        ) : (
          <div className="size-22 rounded-lg" style={{ background: "var(--color-surface-2)" }} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="truncate text-3xl font-black tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              {profile.name}
            </h1>
            <span className="text-xl font-bold text-secondary">#{profile.tag}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
            <span>{t.stats.level} {profile.level}</span>
            <span className="uppercase">{profile.region}</span>
            {profile.lastUpdated ? (
              <span className="text-tertiary text-xs">{t.profile.lastUpdated}: {profile.lastUpdated}</span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WatchlistButton
            riotName={profile.name}
            riotTag={profile.tag}
            puuid={profile.puuid}
            addLabel={t.profile.addToWatchlist}
            watchingLabel={t.profile.watching}
            signInLabel={t.nav.signIn}
          />
          <button className="trn-button h-10 gap-2 text-sm" title={t.profile.refresh}>
            <RefreshCw className="size-4" />
            <span className="hidden lg:inline">{t.profile.refresh}</span>
          </button>
          <Link href={`${basePath}/share`} className="trn-button h-10 gap-2 text-sm" title={t.profile.shareCard}>
            <Share2 className="size-4" />
            <span className="hidden lg:inline">{t.profile.shareCard}</span>
          </Link>
        </div>
      </div>

      {/* rank strip */}
      <div className="flex flex-wrap items-center gap-3 border-t px-6 py-3 text-sm" style={{ borderColor: "rgba(255,255,255,.06)" }}>
        <Image src={tierIcon(profile.currentTier)} alt={profile.currentRank} width={40} height={40} />
        <div>
          <div className="font-bold">{profile.currentRank}</div>
          <div className="text-xs text-secondary">
            {profile.rr} RR{profile.rankPosition ? ` · #${profile.rankPosition}` : ""}
            {profile.elo ? ` · Elo ${profile.elo}` : ""}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-secondary">
          <span>{t.stats.peak}: <b className="text-primary">{profile.peakRank}</b>{profile.peakAct ? ` (${profile.peakAct.toUpperCase()})` : ""}</span>
        </div>
      </div>

      {/* tabs */}
      <nav className="flex overflow-x-auto border-t px-2" style={{ borderColor: "rgba(255,255,255,.06)", background: "rgba(0,0,0,.25)" }}>
        {TABS.map((tab) => (
          <Link
            key={tab}
            href={tab === "overview" ? basePath : `${basePath}/${tab}`}
            className={`profile-tab ${activeTab === tab ? "profile-tab--active" : ""}`}
          >
            {t.tabs[tab]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
