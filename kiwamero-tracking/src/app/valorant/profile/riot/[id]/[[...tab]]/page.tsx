import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { loadProfile } from "@/lib/data";
import { formatAct } from "@/lib/profile-stats";
import { getStoredMatches, playerCardArt } from "@/lib/henrikdev";
import {
  activityByDay,
  aggregate,
  bestMatchesByKills,
  buildEncounters,
  groupByAgent,
  groupByMap,
  groupBySeason,
  normalizeStoredMatch,
  type SeasonStat,
} from "@/lib/stored-stats";
import { getDict } from "@/lib/i18n/server";
import { ProfileHero, type ProfileTab } from "@/components/profile/hero";
import { FiltersBar } from "@/components/profile/filters-bar";
import { RatingCard } from "@/components/profile/rating-card";
import { OverviewCard } from "@/components/profile/overview-card";
import { TopAgentsCard } from "@/components/profile/top-agents";
import { MatchesCard } from "@/components/profile/matches-card";
import { AccuracyCard, RolesCard, TopMapsCard } from "@/components/profile/sidebar-cards";
import { ActivityCard } from "@/components/profile/activity-card";
import { TeammatesCard } from "@/components/profile/teammates-card";
import { BestMatchesCard } from "@/components/profile/best-matches-card";
import { AgentsTable } from "@/components/profile/agents-table";
import { MapsTable } from "@/components/profile/maps-table";
import { PerformanceTable } from "@/components/profile/performance-table";
import { EncountersTable } from "@/components/profile/encounters-table";
import { EmptyTab } from "@/components/profile/empty-tab";
import { DiagnosisPanel } from "@/components/profile/diagnosis-panel";
import { ShareCard } from "@/components/profile/share-card";
import { headers } from "next/headers";

const VALID_TABS = new Set([
  "overview", "matches", "performance", "agents", "maps",
  "weapons", "encounters", "customs", "crosshairs", "lineups",
  "diagnosis", "share",
]);

const EMPTY_TABS: Record<string, string> = {
  weapons: "Weapons",
  customs: "Customs",
  crosshairs: "Crosshairs",
  lineups: "Lineups",
};

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; tab?: string[] }>;
  searchParams: Promise<{ playlist?: string; act?: string; season?: string }>;
}) {
  const { id, tab } = await params;
  const decoded = decodeURIComponent(id);
  const m = decoded.match(/^(.+?)#(.+)$/);
  if (!m) notFound();
  const activeTab = (tab?.[0] ?? "overview") as ProfileTab | "share";
  if (!VALID_TABS.has(activeTab)) notFound();
  const basePath = `/valorant/profile/riot/${encodeURIComponent(`${m[1]}#${m[2]}`)}`;
  const query = await searchParams;
  const playlist = ["competitive", "premier", "unrated", "deathmatch", "swiftplay", "all"].includes(query.playlist ?? "")
    ? query.playlist! : "competitive";
  const seasonParam = query.season ?? query.act;
  const act = seasonParam === "all" || seasonParam == null ? seasonParam ?? "latest" : seasonParam;

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent name={m[1]} tag={m[2]} activeTab={activeTab} basePath={basePath} playlist={playlist} act={act} />
    </Suspense>
  );
}

async function ProfileContent({
  name,
  tag,
  activeTab,
  basePath,
  playlist,
  act,
}: {
  name: string;
  tag: string;
  activeTab: string;
  basePath: string;
  playlist: string;
  act: string;
}) {
  const t = await getDict();
  const mode = playlist === "all" ? undefined : playlist;
  const result = await loadProfile(name, tag, { mode });
  if (!result.ok) {
    const messages = {
      not_found: t.profile.notFound,
      private: t.profile.unavailablePrivate,
      rate_limited: t.profile.unavailableRateLimited,
      upstream: t.profile.unavailableUpstream,
    } as const;
    return (
      <div className="kt-container">
        <div className="kt-card-body mt-8 p-12 text-center">
          <h1 style={{ fontFamily: "var(--kt-title)", fontSize: 32, margin: 0 }}>
            {name}
            <span style={{ color: "var(--kt-text-2)" }}>#{tag}</span>
          </h1>
          <p style={{ marginTop: 8, color: "var(--kt-red)", fontWeight: 700 }}>{t.profile.unavailableTitle}</p>
          <p style={{ marginTop: 6, color: "var(--kt-text-2)", fontSize: 14 }}>{messages[result.reason]}</p>
          <Link href="/" className="kt-btn kt-btn--secondary" style={{ marginTop: 20 }}>
            {t.nav.home}
          </Link>
        </div>
      </div>
    );
  }

  const { profile, summary, topAgents, seasons, matches, diagnosis, teammates, capturedAt, source } = result.bundle;
  const latestSeason = matches[0]?.metadata.season_id;
  const targetSeason = act === "all" ? "" : act === "latest" ? latestSeason : act;
  const visibleMatches = matches.filter((match) =>
    (playlist === "all" || match.metadata.mode_id.toLowerCase().replace(/[^a-z]/g, "") === playlist) &&
    (!targetSeason || match.metadata.season_id === targetSeason)
  );
  const shown = visibleMatches;
  const actLabel = formatAct(profile.actCode ?? seasons[0]?.actCode);
  const banner = profile.cardId ? playerCardArt(profile.cardId, "wideart") : null;
  const cardArt = profile.cardId ? playerCardArt(profile.cardId, "smallart") : null;

  // Stored match history powers the aggregation tabs (matches/performance/agents/maps)
  // and the hero banner art (tracker.gg uses a per-agent "hero" image).
  const stored = await getStoredMatches(profile.region, profile.puuid, { mode }).catch(() => []);
  const storedAll = stored.map(normalizeStoredMatch);
  const latestHeroSeason = storedAll.reduce(
    (best, r) => (r.startedAt > best.ts && r.seasonId ? { id: r.seasonId, ts: r.startedAt } : best),
    { id: "", ts: 0 },
  ).id;
  const heroAgent = groupByAgent(storedAll.filter((r) => r.seasonId === latestHeroSeason))[0]?.agent
    ?? groupByAgent(storedAll)[0]?.agent;
  const heroArt = heroAgent
    ? `https://trackercdn.com/cdn/tracker.gg/valorant/images/heroes/hero-${heroAgent.toLowerCase().replace(/[^a-z0-9]/g, "")}.jpg`
    : null;
  const latestStoredSeason = storedAll.reduce(
    (best, r) => (r.startedAt > best.ts && r.seasonId ? { id: r.seasonId, ts: r.startedAt } : best),
    { id: "", ts: 0 },
  ).id;
  const storedScoped = act === "all"
    ? storedAll
    : storedAll.filter((r) => r.seasonId === (act === "latest" ? latestStoredSeason : act));

  const shareOrigin = activeTab === "share" ? await origin() : "";
  const seasonStats = groupBySeason(storedAll);
  const lifetime: SeasonStat = {
    seasonId: "", seasonShort: "",
    stats: aggregate(storedAll),
    topAgent: groupByAgent(storedAll)[0] ?? null,
  };

  const sidebar = (() => {
    switch (activeTab) {
      case "overview":
      case "diagnosis":
      case "share":
        return (
          <>
            <RatingCard profile={profile} />
            <AccuracyCard matches={shown} puuid={profile.puuid} />
            <RolesCard matches={shown} puuid={profile.puuid} />
            <TopMapsCard matches={shown} puuid={profile.puuid} basePath={basePath} />
            {source === "seed" ? (
              <div className="kt-card-body" style={{ padding: 12, fontSize: 12, color: "#e6d28c" }}>
                Live data is unavailable; showing a cached sample for Meiy#B3L.
              </div>
            ) : null}
          </>
        );
      case "matches":
        return (
          <>
            <ActivityCard counts={activityByDay(storedAll, 60, Date.parse(capturedAt))} capturedAt={capturedAt} />
            <TeammatesCard teammates={teammates} />
          </>
        );
      case "performance":
        return <BestMatchesCard rows={bestMatchesByKills(storedAll)} now={Date.parse(capturedAt)} />;
      default:
        return null;
    }
  })();

  const main = (() => {
    switch (activeTab) {
      case "matches":
        return <MatchesCard profile={profile} matches={shown} limit={20} basePath={basePath} capturedAt={capturedAt} showAllLink={false} />;
      case "performance":
        return (
          <PerformanceTable
            seasons={seasonStats}
            lifetime={lifetime}
            ranks={seasons}
            actLabel={actLabel}
            currentRr={profile.rr}
            currentActCode={profile.actCode}
          />
        );
      case "agents":
        return <AgentsTable agents={groupByAgent(storedScoped)} />;
      case "maps":
        return <MapsTable maps={groupByMap(storedScoped)} />;
      case "encounters": {
        // v3 match rosters only cover the most recent matches; encounters aggregate
        // everyone met across them (playlist filter applies, season filter cannot).
        const scoped = matches.filter((match) =>
          playlist === "all" || match.metadata.mode_id.toLowerCase().replace(/[^a-z]/g, "") === playlist
        );
        return <EncountersTable encounters={buildEncounters(scoped, name, tag)} withOnly={false} />;
      }
      case "diagnosis":
        return <DiagnosisPanel diagnosis={diagnosis} />;
      case "share":
        return (
          <ShareCard
            profile={profile}
            summary={summary}
            topAgents={topAgents}
            shareUrl={`${shareOrigin}${basePath}/share`}
          />
        );
      case "overview":
        return (
          <>
            <OverviewCard profile={profile} matches={shown} actLabel={actLabel} playlist={playlist} basePath={basePath} />
            <TopAgentsCard
              agents={topAgents}
              matches={shown}
              puuid={profile.puuid}
              actLabel={actLabel}
              basePath={basePath}
            />
            <MatchesCard profile={profile} matches={shown} basePath={basePath} capturedAt={capturedAt} />
            <p style={{ fontSize: 12, lineHeight: "18px", color: "var(--kt-dim)", margin: 0 }}>
              Kiwamero Tracking isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of
              Riot Games or anyone officially involved in producing or managing Riot Games properties. Data captured{" "}
              {new Date(capturedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.
            </p>
          </>
        );
      default:
        return (
          <EmptyTab
            title={EMPTY_TABS[activeTab] ?? "Tab"}
            messageTitle={t.profile.notAvailableTitle}
            messageBody={t.profile.notAvailableBody}
          />
        );
    }
  })();

  return (
    <div className="kt-container">
      <ProfileHero
        profile={profile}
        activeTab={activeTab}
        basePath={basePath}
        banner={heroArt ?? banner}
        cardArt={cardArt}
      />

      <FiltersBar basePath={basePath} playlist={playlist} act={act} actLabel={actLabel} />

      <div className={`kt-columns${sidebar ? "" : " kt-columns--full"}`}>
        {sidebar ? <aside className="kt-sidebar">{sidebar}</aside> : null}
        <div className="kt-maincol">{main}</div>
      </div>
    </div>
  );
}

async function origin() {
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3002"}`;
}

function ProfileSkeleton() {
  return (
    <div className="kt-container">
      <div className="kt-hero" style={{ marginTop: 24 }} />
      <div className="kt-columns">
        <div className="kt-sidebar">
          <div className="kt-card-body" style={{ height: 220 }} />
        </div>
        <div className="kt-maincol">
          <div className="kt-card-body" style={{ height: 400 }} />
        </div>
      </div>
    </div>
  );
}
