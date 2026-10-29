import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import type { Profile } from "@/lib/types";
import { WatchlistButton } from "./watchlist-button";
import { RefreshProfileButton } from "./refresh-profile-button";
import { ShareProfileButton } from "./share-profile-button";

export type ProfileTab =
  | "overview" | "matches" | "performance" | "agents" | "maps"
  | "weapons" | "encounters" | "assessment" | "customs" | "crosshairs" | "lineups"
  | "diagnosis" | "share";


const TABS: { key: string; labelKey: string; isNew?: boolean }[] = [
  { key: "overview", labelKey: "overview" },
  { key: "matches", labelKey: "matches" },
  { key: "performance", labelKey: "performance" },
  { key: "encounters", labelKey: "encounters" },
  { key: "assessment", labelKey: "assessment" },
  { key: "diagnosis", labelKey: "diagnosis" },
];

export function ProfileHero({
  profile,
  activeTab,
  basePath,
  banner,
  cardArt,
  heroExtra,
  tabLabels = {},
}: {
  profile: Profile;
  activeTab: string;
  basePath: string;
  banner: string | null;
  cardArt: string | null;
  heroExtra?: ReactNode;
  tabLabels?: Record<string, string>;
}) {
  const isJapan = profile.region?.toUpperCase() === "AP";
  return (
    <div className="kt-hero-wrap">
      {banner ? (
        <div className="kt-hero-ambient" style={{ backgroundImage: `url("${banner}")` }} aria-hidden="true" />
      ) : null}
      <RefreshProfileButton />
      <div className="kt-hero">
        {banner ? (
          <Image src={banner} alt="" fill priority sizes="1392px" className="kt-hero-art" />
        ) : null}
        <div className="kt-hero-shade" />

        {heroExtra ? <div className="kt-hero-extra">{heroExtra}</div> : null}

        <div className="kt-hero-body">
          <div className="kt-hero-identity">
            <div className="kt-hero-avatar">
              {cardArt ? <Image src={cardArt} alt="" width={100} height={100} /> : null}
              {isJapan ? (
                <span className="kt-hero-flag" aria-label="Japan">
                  <svg viewBox="0 0 24 24" width="100%" height="100%">
                    <rect width="24" height="24" fill="#fff" />
                    <circle cx="12" cy="12" r="6.5" fill="#bc002d" />
                  </svg>
                </span>
              ) : null}
            </div>

            <div className="kt-hero-names">
              <div className="kt-hero-views">
                <Eye size={14} aria-hidden="true" />
                <span>Public profile</span>
              </div>
              <div className="kt-hero-name-row">
                <RiotVerified />
                <span className="kt-hero-name">{profile.name}</span>
                <span className="kt-hero-tag">#{profile.tag}</span>
              </div>
            </div>

            <div className="kt-hero-actions">
              <WatchlistButton
                riotName={profile.name}
                riotTag={profile.tag}
                puuid={profile.puuid}
                addLabel="Add to Watchlist"
                watchingLabel="Remove from Watchlist"
                signInLabel="Sign in to watch this player"
                variant="icon"
              />
              <ShareProfileButton />
            </div>
          </div>

          <nav className="kt-tabs" aria-label="Profile sections">
            {TABS.map((tab) =>
              <Link
                key={tab.key}
                href={tab.key === "overview" ? basePath : `${basePath}/${tab.key}`}
                className="kt-tab"
                data-active={activeTab === tab.key}
              >
                {tabLabels[tab.labelKey] ?? tab.key}
                {tab.isNew ? <span className="kt-badge-new">NEW</span> : null}
              </Link>
            )}
          </nav>
        </div>
      </div>
    </div>
  );
}

function RiotVerified() {
  return (
    <span className="kt-verified-riot" aria-label="Riot account">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M2 7.3 14.8 2l6.8 2.1-1.3 15.1-4.6.6-.5-6.1-.9.2.3 6.3-4.8.6-.6-6.2-.9.2.6 6.2-4.6.6L2 7.3Z" fill="currentColor" />
        <path d="m13.8 18.9 7.2 1.2v-3.4l-7.3 1Z" fill="currentColor" />
      </svg>
      <i aria-hidden="true">✓</i>
    </span>
  );
}
