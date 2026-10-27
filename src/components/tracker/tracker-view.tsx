"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProfileHero } from "./profile-hero";
import { TrackerTabs, type TrackerTab } from "./tracker-tabs";
import { TopAgentsCard } from "./top-agents-card";
import { TeammatesCard, type Teammate } from "./teammates-card";
import { StatsSummary } from "./stats-summary";
import { MatchFilters } from "./match-filters";
import { MatchCard } from "./match-card";
import { Pagination } from "./pagination";
import { AnalyticsTab } from "./analytics-tab";
import { SeasonRanksTab } from "./season-ranks-tab";
import { AppraisalTab, SmurfTab } from "./diagnosis-tabs";
import type { Match, AgentBreakdown, SeasonRank } from "@/lib/types";

interface Props {
  profile: {
    name: string; tag: string; puuid: string; level: number; region: string;
    cardId: string; lastUpdated: string;
  };
  summary: {
    winRate: number; matches: number; wins: number; losses: number;
    kd: number; kills: number; deaths: number; assists: number;
    acs: number; adr: number; hs: number; totalMatches: number;
  };
  topAgents: AgentBreakdown[];
  teammates: Teammate[];
  matches: Match[];
  capturedAt: number;
  seasons: SeasonRank[];
  diagnosis: { playerStats: { title: string; description: string; severity?: string }[]; topCluster: { title: string; description: string; type?: string }[] };
}

const PER_PAGE = 20;

export function TrackerView({ profile, summary, topAgents, teammates, matches, capturedAt, seasons, diagnosis }: Props) {
  const [tab, setTab] = useState<TrackerTab>("matches");
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(summary.totalMatches / PER_PAGE));
  const shown = matches.slice(0, PER_PAGE);

  return (
    <div className="relative z-10 container mx-auto max-w-7xl px-4 pt-8 pb-4">
      <Link href="/">
        <button className="mb-6 -ml-1 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </button>
      </Link>

      <ProfileHero
        name={profile.name}
        tag={profile.tag}
        level={profile.level}
        region={profile.region}
        cardId={profile.cardId}
        lastUpdated={profile.lastUpdated}
      />

      <TrackerTabs active={tab} onChange={setTab} />

      {tab === "matches" && (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="space-y-5">
            <TopAgentsCard agents={topAgents} />
            <TeammatesCard teammates={teammates} />
          </div>
          <div>
            <StatsSummary s={summary} />
            <div className="mt-4">
              <MatchFilters />
            </div>
            <p className="mb-3 text-right text-xs font-mono text-muted-foreground">
              全 <strong className="text-foreground">{summary.totalMatches}</strong> 試合中 1〜{shown.length} 件表示
            </p>
            {shown.map((m) => (
              <MatchCard key={m.metadata.matchid} match={m} puuid={profile.puuid} capturedAt={capturedAt} />
            ))}
            <Pagination
              page={page}
              totalPages={totalPages}
              total={summary.totalMatches}
              perPage={PER_PAGE}
              onChange={setPage}
            />
          </div>
        </div>
      )}

      {tab === "analytics" && <AnalyticsTab agents={topAgents} />}
      {tab === "seasons" && <SeasonRanksTab seasons={seasons} />}
      {tab === "appraisal" && <AppraisalTab items={diagnosis.topCluster} />}
      {tab === "smurf" && <SmurfTab items={diagnosis.playerStats} />}
    </div>
  );
}
