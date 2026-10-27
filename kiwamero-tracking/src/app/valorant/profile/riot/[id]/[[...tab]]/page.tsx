import { notFound } from "next/navigation";
import { Suspense } from "react";
import { loadProfile } from "@/lib/data";
import { getDict } from "@/lib/i18n/server";
import { ProfileHero, type ProfileTab } from "@/components/profile/profile-hero";
import { StatsGrid } from "@/components/profile/stats-grid";
import { TopAgentsCard } from "@/components/profile/top-agents";
import { TeammatesCard } from "@/components/profile/teammates";
import { MatchList } from "@/components/profile/match-list";
import { SeasonsTable } from "@/components/profile/seasons-table";
import { DiagnosisPanel } from "@/components/profile/diagnosis-panel";

import { ShareCard } from "@/components/profile/share-card";
import { headers } from "next/headers";

const VALID_TABS = new Set(["overview", "matches", "performance", "agents", "maps", "diagnosis", "share"]);

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string; tab?: string[] }>;
}) {
  const { id, tab } = await params;
  const decoded = decodeURIComponent(id);
  const m = decoded.match(/^(.+?)#(.+)$/);
  if (!m) notFound();
  const activeTab = (tab?.[0] ?? "overview") as ProfileTab | "share";
  if (!VALID_TABS.has(activeTab)) notFound();
  const basePath = `/valorant/profile/riot/${encodeURIComponent(`${m[1]}#${m[2]}`)}`;

  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent name={m[1]} tag={m[2]} activeTab={activeTab} basePath={basePath} />
    </Suspense>
  );
}

async function ProfileContent({
  name,
  tag,
  activeTab,
  basePath,
}: {
  name: string;
  tag: string;
  activeTab: string;
  basePath: string;
}) {
  const t = await getDict();
  const result = await loadProfile(name, tag);
  if (!result.ok) {
    const messages = {
      not_found: t.profile.notFound,
      private: t.profile.unavailablePrivate,
      rate_limited: t.profile.unavailableRateLimited,
      upstream: t.profile.unavailableUpstream,
    } as const;
    return (
      <div className="py-6">
        <div className="trn-card mx-auto max-w-xl px-8 py-12 text-center">
          <h1 className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
            {name}<span className="text-secondary">#{tag}</span>
          </h1>
          <p className="mt-2 font-bold text-action" style={{ color: "var(--color-action)" }}>
            {t.profile.unavailableTitle}
          </p>
          <p className="mt-2 text-sm text-secondary">{messages[result.reason]}</p>
        </div>
      </div>
    );
  }
  const { profile, summary, topAgents, teammates, seasons, diagnosis, matches, capturedAt, source } = result.bundle;

  return (
    <div className="py-6">
      <ProfileHero profile={profile} activeTab={activeTab} basePath={basePath} />

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {activeTab === "overview" || activeTab === "matches" ? (
            <>
              {activeTab === "overview" ? (
                <>
                  <StatsGrid summary={summary} />
                  <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-tertiary">
                    {t.matches.recentMatches}
                  </h2>
                </>
              ) : null}
              <MatchList
                matches={matches}
                puuid={profile.puuid}
                capturedAt={capturedAt}
                labels={{
                  mode: t.matches.filterMode,
                  map: t.matches.filterMap,
                  agent: t.matches.filterAgent,
                  loadMore: t.matches.loadMore,
                }}
              />
            </>
          ) : null}

          {activeTab === "performance" || activeTab === "agents" || activeTab === "maps" ? (
            <SeasonsTable seasons={seasons} kind={activeTab} matches={matches} puuid={profile.puuid} />
          ) : null}

          {activeTab === "diagnosis" ? <DiagnosisPanel diagnosis={diagnosis} /> : null}

          {activeTab === "share" ? (
            <ShareCard
              profile={profile}
              summary={summary}
              topAgents={topAgents}
              shareUrl={`${await origin()}${basePath}/share`}
            />
          ) : null}
        </div>

        {/* sidebar */}
        <aside className="space-y-4">
          <TopAgentsCard agents={topAgents} />
          <TeammatesCard mates={teammates} />
          {source === "seed" ? (
            <div className="rounded-lg px-3 py-2 text-xs text-tertiary" style={{ background: "var(--color-surface-2)" }}>
              Showing cached sample data (API key not configured).
            </div>
          ) : null}
        </aside>
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
    <div className="animate-pulse py-6">
      <div className="h-64 rounded-xl" style={{ background: "var(--color-surface-1)" }} />
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          <div className="h-24 rounded-lg" style={{ background: "var(--color-surface-1)" }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-lg" style={{ background: "var(--color-surface-1)" }} />
          ))}
        </div>
        <div className="h-96 rounded-lg" style={{ background: "var(--color-surface-1)" }} />
      </div>
    </div>
  );
}
