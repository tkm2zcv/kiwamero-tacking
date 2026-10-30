import { notFound } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { loadProfile } from "@/lib/data";
import { formatAct } from "@/lib/profile-stats";
import { createActFilter, filterProfileMatches, profileFilterHref, selectUncoveredMatchIds } from "@/lib/profile-filters";
import { getMatch, playerCardArt, tierIcon, tierName } from "@/lib/henrikdev";
import { normalizeHDMatch } from "@/lib/match-normalize";
import type { Match } from "@/lib/types";
import {
  activityByDay,
  aggregate,
  bestMatchesByKills,
  buildEncounters,
  groupByAgent,
  groupByMap,
  groupBySeason,
  normalizeStoredMatch,
  storedRowToMatch,
  type SeasonStat,
} from "@/lib/stored-stats";
import { getDict, getLocale } from "@/lib/i18n/server";
import { buildAccountReport } from "@/lib/account-report";
import { ProfileHero, type ProfileTab } from "@/components/profile/hero";
import { FiltersBar } from "@/components/profile/filters-bar";
import { OverviewCard } from "@/components/profile/overview-card";
import { MatchesCard } from "@/components/profile/matches-card";

import { ActivityCard } from "@/components/profile/activity-card";
import { TeammatesCard } from "@/components/profile/teammates-card";
import { BestMatchesCard } from "@/components/profile/best-matches-card";
import { AgentsTable } from "@/components/profile/agents-table";
import { MapsTable } from "@/components/profile/maps-table";
import { PerformanceTable } from "@/components/profile/performance-table";
import { EncountersTable } from "@/components/profile/encounters-table";
import { AccountAudit } from "@/components/profile/account-audit";
import { EmptyTab } from "@/components/profile/empty-tab";
import { DiagnosisPanel } from "@/components/profile/diagnosis-panel";
import { ShareCard } from "@/components/profile/share-card";
import { ProfileViewRecorder } from "@/components/profile/profile-view-recorder";
import { headers } from "next/headers";

/** Max per-match detail fetches for one encounters render (immutable, 24h-cached upstream). */
const ENCOUNTER_DETAIL_CAP = 150;

const VALID_TABS = new Set([
  "overview", "matches", "performance", "agents", "maps",
  "weapons", "encounters", "assessment", "customs", "crosshairs", "lineups",
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
  searchParams: Promise<{ playlist?: string; act?: string; season?: string; played?: string; page?: string }>;
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
  const act = seasonParam ?? "all";
  const played = query.played === "against" ? "against" : "with";
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent name={m[1]} tag={m[2]} activeTab={activeTab} basePath={basePath} playlist={playlist} act={act} played={played} page={page} />
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
  played,
  page,
}: {
  name: string;
  tag: string;
  activeTab: string;
  basePath: string;
  playlist: string;
  act: string;
  played: "with" | "against";
  page: number;
}) {
  const t = await getDict();
  const isReport = activeTab === "assessment" || activeTab === "diagnosis";
  const mode = isReport ? "competitive" : playlist === "all" ? undefined : playlist;
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

  const { profile, summary, topAgents, seasons, matches, teammates, capturedAt, source } = result.bundle;
  const banner = profile.cardId ? playerCardArt(profile.cardId, "wideart") : null;
  const cardArt = profile.cardId ? playerCardArt(profile.cardId, "smallart") : null;

  // Stored match history powers the aggregation tabs (matches/performance/agents/maps)
  // and the hero banner art (tracker.gg uses a per-agent "hero" image).
  const storedAll = result.storedMatches.map(normalizeStoredMatch);
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
  ).id || matches.reduce(
    (best, match) => match.metadata.game_start > best.ts && match.metadata.season_id
      ? { id: match.metadata.season_id, ts: match.metadata.game_start } : best,
    { id: "", ts: 0 },
  ).id;

  // Season/act selector: tracker.gg lists every canonical act from the player's
  // FIRST act through the current one, newest first. Act codes are "e{n}a{m}"
  // (episodes 1–9 have 3 acts, the yearly seasons e10+ have 6).
  const actCodeOrder = (code: string) => {
    const m = code.toLowerCase().match(/^e(\d+)a(\d+)$/);
    return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
  };
  const seasonUuid = new Map<string, string>();
  const uuidToShort = new Map<string, string>();
  for (const r of storedAll) {
    const short = r.seasonShort?.toLowerCase();
    if (short && r.seasonId) {
      seasonUuid.set(short, r.seasonId);
      uuidToShort.set(r.seasonId.toLowerCase(), short);
    }
  }
  const dataActCodes = seasons
    .map((s) => s.actCode.toLowerCase())
    .filter((c) => actCodeOrder(c) >= 0)
    .sort((a, b) => actCodeOrder(a) - actCodeOrder(b));
  const firstAct = dataActCodes[0];
  const lastActCode = dataActCodes[dataActCodes.length - 1];
  const canonical: string[] = [];
  if (firstAct && lastActCode) {
    const dataSet = new Set(dataActCodes);
    const lastEp = Number(lastActCode.match(/^e(\d+)a/)?.[1] ?? 0);
    for (let ep = 1; ep <= lastEp; ep++) {
      const maxData = Math.max(
        0,
        ...[...dataSet]
          .filter((c) => c.startsWith(`e${ep}a`))
          .map((c) => Number(c.split("a")[1])),
      );
      const actsInEp = Math.max(ep < 10 ? 3 : 6, maxData);
      for (let a = 1; a <= actsInEp; a++) {
        const code = `e${ep}a${a}`;
        if (actCodeOrder(code) >= actCodeOrder(firstAct) && actCodeOrder(code) <= actCodeOrder(lastActCode)) {
          canonical.push(code);
        }
      }
    }
  }
  // Prefer the season uuid for the URL (matches tracker.gg's `?season=<uuid>`);
  // fall back to the act code when no stored match exposes its uuid yet.
  const acts = canonical
    .map((code) => ({ code, param: seasonUuid.get(code) ?? code, label: formatAct(code) }))
    .reverse();

  // Resolve the `act` param ("all" | "latest" | season uuid | act code) to a
  // predicate shared by v3 matches (uuid only) and stored matches (uuid+short).
  const actParam = act.toLowerCase();
  const resolvedShort =
    act === "all" || act === "latest"
      ? undefined
      : dataActCodes.includes(actParam)
        ? actParam
        : uuidToShort.get(actParam);
  const inSelectedAct = createActFilter(act, seasonUuid, uuidToShort, latestStoredSeason);
  const storedScoped = storedAll.filter((r) => inSelectedAct(r.seasonId, r.seasonShort));
  const visibleMatches = filterProfileMatches(matches, playlist, inSelectedAct, uuidToShort);
  // Full stored history fills the match list; recent v3 matches (with rosters)
  // take precedence so their scoreboard/expand detail stays intact. The matches
  // tab pages server-side (`?page=`) so every match stays reachable while the
  // serialized payload stays bounded to one page of rows.
  const MATCH_PAGE_SIZE = 20;
  const recentIds = new Set(visibleMatches.map((m) => m.metadata.matchid));
  // v3 sometimes returns cluster:null where stored history has the real server —
  // borrow it so the server chip shows on recent rows too.
  const clusterById = new Map(storedAll.map((r) => [r.id, r.cluster] as const));
  const allMatches = [
    ...visibleMatches.map((m) =>
      !m.metadata.cluster && clusterById.get(m.metadata.matchid)
        ? { ...m, metadata: { ...m.metadata, cluster: clusterById.get(m.metadata.matchid)! } }
        : m),
    ...storedScoped
      .filter((r) => r.id && !recentIds.has(r.id))
      .map((r) => storedRowToMatch(r, { puuid: profile.puuid, name: profile.name, tag: profile.tag })),
  ].sort((a, b) => b.metadata.game_start - a.metadata.game_start);
  const totalMatchPages = Math.max(1, Math.ceil(allMatches.length / MATCH_PAGE_SIZE));
  const matchPageNum = Math.min(page, totalMatchPages);
  const matchPage = allMatches.slice((matchPageNum - 1) * MATCH_PAGE_SIZE, matchPageNum * MATCH_PAGE_SIZE);
  const overviewMatches = allMatches.slice(0, 60);

  const latestActLabel = formatAct(profile.actCode ?? lastActCode ?? seasons[0]?.actCode);
  const selectedActItem =
    act === "all" || act === "latest"
      ? acts[0]
      : acts.find((a) => a.param.toLowerCase() === actParam || a.code === resolvedShort);
  const actLabel = selectedActItem?.label ?? latestActLabel;

  const shareOrigin = activeTab === "share" ? await origin() : "";
  const seasonStats = groupBySeason(storedScoped);
  const lifetime: SeasonStat = {
    seasonId: "", seasonShort: "",
    stats: aggregate(storedAll),
    topAgent: groupByAgent(storedAll)[0] ?? null,
  };

  const sidebar = (() => {
    switch (activeTab) {
      case "overview":
      case "share":
        return (
          <>
            <TeammatesCard teammates={teammates} basePath={basePath} />
            <ActivityCard counts={activityByDay(storedAll, 60, Date.parse(capturedAt))} capturedAt={capturedAt} />
          </>
        );
      case "matches":
        return (
          <>
            <TeammatesCard teammates={teammates} basePath={basePath} />
            <ActivityCard counts={activityByDay(storedAll, 60, Date.parse(capturedAt))} capturedAt={capturedAt} />
          </>
        );
      case "performance":
        return (
          <>
            {/* tracker.gg's TOTAL PLAYTIME card — session playtime isn't available
                from our match data, so render the card with an honest dash. */}
            <div className="playtime-summary trn-card">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 19.949 19.97" className="playtime-summary__icon" aria-hidden="true">
                <path d="M10.95 0v2.02a8 8 0 0 1 0 15.88v2a10 10 0 0 0 0-19.9m-2 .03a9.83 9.83 0 0 0-5.33 2.2l1.43 1.48a8 8 0 0 1 3.9-1.68zM2.21 3.64A9.9 9.9 0 0 0 0 8.97h2a8 8 0 0 1 1.64-3.9zm-2.2 7.33a10.04 10.04 0 0 0 2.21 5.33l1.42-1.43a8 8 0 0 1-1.63-3.9zm5.04 5.37-1.43 1.37a10 10 0 0 0 5.33 2.26v-2a8 8 0 0 1-3.9-1.63m5.4-11.37v5.25l4.5 2.67-.75 1.23-5.25-3.15v-6Z" />
              </svg>
              <div className="playtime-summary__meta">
                <div>
                  <div className="label">Total Playtime</div>
                  <div className="value">-</div>
                </div>
                <div>
                  <div className="label">All Modes</div>
                  <div className="value">&nbsp;</div>
                </div>
              </div>
            </div>
            <BestMatchesCard rows={bestMatchesByKills(storedScoped)} now={Date.parse(capturedAt)} />
          </>
        );
      default:
        return null;
    }
  })();

  // Encounters: recent v3 rosters plus on-demand detail fetches for stored
  // matches in the selected act — HenrikDev's stored endpoint carries no
  // rosters, so each uncovered match needs one /v2/match/{id} call. Details
  // are immutable and cached 24h, so repeat visits are cheap; fetches run in
  // parallel batches and individual failures are skipped. `season=all` limits
  // the first-visit scope to the two most recent acts — older encounters are
  // rarer and a cold visit shouldn't burn the upstream quota on them.
  let encounterMatches: Match[] = visibleMatches;
  let encounterRows = storedScoped;
  let encounterCovered = 0;
  if (activeTab === "encounters") {
    if (act === "all") {
      const latestByAct = new Map<string, number>();
      for (const r of storedScoped) {
        if (r.seasonId) {
          latestByAct.set(r.seasonId, Math.max(latestByAct.get(r.seasonId) ?? 0, r.startedAt));
        }
      }
      const keep = new Set(
        [...latestByAct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([s]) => s),
      );
      encounterRows = storedScoped.filter((r) => r.seasonId && keep.has(r.seasonId));
    }
    const uncovered = selectUncoveredMatchIds(encounterRows, recentIds, ENCOUNTER_DETAIL_CAP);
    const fetched: Match[] = [];
    for (let i = 0; i < uncovered.length; i += 10) {
      const batch = await Promise.allSettled(
        uncovered.slice(i, i + 10).map((id) => getMatch(id)));
      for (const res of batch) {
        if (res.status === "fulfilled") fetched.push(normalizeHDMatch(res.value));
      }
    }
    encounterMatches = [...visibleMatches, ...fetched];
    encounterCovered = Math.min(encounterRows.length, visibleMatches.length + fetched.length);
  }

  // Reports have an explicit account-wide Competitive scope. Reuse the recent
  // roster response; these tabs must not fan out into dozens of detail fetches.
  let accountReport: ReturnType<typeof buildAccountReport> | null = null;
  if (isReport) {
    accountReport = buildAccountReport({
      profile, seasons, storedAll,
      rosterMatches: activeTab === "diagnosis" ? matches : [],
      locale: await getLocale(),
      generatedAt: capturedAt,
    });
  }

  const main = (() => {
    switch (activeTab) {
      case "matches": {
        const pageHref = (n: number) => `${profileFilterHref(basePath, "matches", playlist, act)}&page=${n}`;
        return (
          <>
            <MatchesCard profile={profile} matches={matchPage} limit={MATCH_PAGE_SIZE} basePath={basePath} capturedAt={capturedAt} showAllLink={false} bare />
            {totalMatchPages > 1 ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 4px", fontSize: 13 }}>
                {matchPageNum > 1
                  ? <Link href={pageHref(matchPageNum - 1)} className="kt-btn kt-btn--secondary">← Newer</Link>
                  : <span />}
                <span style={{ color: "var(--kt-dim)" }}>
                  Page {matchPageNum} / {totalMatchPages} · {allMatches.length} matches
                </span>
                {matchPageNum < totalMatchPages
                  ? <Link href={pageHref(matchPageNum + 1)} className="kt-btn kt-btn--secondary">Older →</Link>
                  : <span />}
              </div>
            ) : null}
          </>
        );
      }
      case "performance":
        return (
          <PerformanceTable
            seasons={seasonStats}
            lifetime={lifetime}
            ranks={seasons}
            actItems={acts.map((a) => ({
              label: a.label,
              href: `${basePath}/performance?platform=pc&playlist=${playlist}&season=${a.param}`,
              active: a.param.toLowerCase() === actParam || a.code === resolvedShort,
            }))}
            currentRr={profile.rr}
            currentActCode={profile.actCode}
          />
        );
      case "agents":
        return <AgentsTable agents={groupByAgent(storedScoped)} />;
      case "maps":
        return <MapsTable maps={groupByMap(storedScoped)} />;
      case "encounters": {
        const playedHref = (p: "with" | "against") =>
          profileFilterHref(basePath, "encounters", playlist, act, p);
        return (
          <>
            {act === "all" || encounterCovered < encounterRows.length ? (
              <p className="text-secondary text-13" style={{ padding: "4px 2px" }}>
                Encounters computed from {encounterCovered} of {encounterRows.length} matches
                {act === "all"
                  ? " in the two latest acts — pick a specific act for older encounters"
                  : " in this act (newest first — details load progressively as you revisit)"}.
              </p>
            ) : null}
            <EncountersTable
              encounters={buildEncounters(encounterMatches, name, tag)}
              mode={played}
              filterItems={[
                { label: "Played With", href: playedHref("with"), active: played === "with" },
                { label: "Played Against", href: playedHref("against"), active: played === "against" },
              ]}
            />
          </>
        );
      }
      case "assessment":
        return accountReport
          ? <AccountAudit profile={profile} report={accountReport} />
          : null;
      case "diagnosis":
        return accountReport ? <DiagnosisPanel report={accountReport} /> : null;
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
            <OverviewCard profile={profile} matches={overviewMatches} stats={aggregate(storedScoped)} actLabel={actLabel} playlist={playlist} basePath={basePath} />
            <MatchesCard profile={profile} matches={overviewMatches} basePath={basePath} capturedAt={capturedAt} bare />
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
      <ProfileViewRecorder
        name={profile.name}
        tag={profile.tag}
        puuid={profile.puuid}
        card={cardArt ?? undefined}
        rankIcon={profile.currentTier ? tierIcon(profile.currentTier, "small") : undefined}
        rankName={profile.currentTier ? tierName(profile.currentTier) : undefined}
      />
      <ProfileHero
        profile={profile}
        activeTab={activeTab}
        basePath={basePath}
        banner={heroArt ?? banner}
        cardArt={cardArt}
        tabLabels={t.tabs as Record<string, string>}
        heroExtra={
          <div className="kt-hero-peak">
            <h3>Peak Rating</h3>
            <div className="kt-rating-entry">
              <Image src={tierIcon(profile.currentTier || 0)} alt="" width={40} height={40} className="kt-rank-icon" />
              <div className="kt-rank-info">
                <div className="kt-rank-value">
                  {profile.peakRank}
                  {profile.peakRr ? <span className="kt-mmr">{profile.peakRr.toLocaleString("en-US")}<sup>RR</sup></span> : null}
                </div>
                {profile.peakAct ? <div className="kt-rank-sub">{formatAct(profile.peakAct)}</div> : null}
              </div>
            </div>
          </div>
        }
      />

      {!isReport ? <FiltersBar
        basePath={basePath}
        tab={activeTab}
        playlist={playlist}
        act={act}
        acts={acts}
        played={played}
      /> : null}

      {source === "seed" ? (
        <p role="status" style={{ padding: 12, fontSize: 12, color: "#e6d28c" }}>
          Live data is unavailable; showing a cached sample for Meiy#B3L.
        </p>
      ) : null}
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
