import type { Metadata } from "next";
import { UserChip } from "@/components/user-chip";
import { SiteFooter } from "@/components/site-footer";
import { TrackerView } from "@/components/tracker/tracker-view";
import profileData from "@/data/profile.json";
import matchesData from "@/data/matches.json";
import type { Match } from "@/lib/types";

export const metadata: Metadata = {
  title: "Tracker | KiwameroTracker",
};

export default function TrackerPage() {
  const p = profileData;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="fixed right-4 top-4 z-20">
        <UserChip />
      </header>
      <main className="flex-1">
        <TrackerView
          profile={p.profile}
          summary={p.summary}
          topAgents={p.topAgents}
          teammates={p.teammates}
          matches={matchesData as Match[]}
          capturedAt={p.capturedAt}
          seasons={p.seasons}
          diagnosis={p.diagnosis}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
