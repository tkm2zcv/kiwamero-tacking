import { after } from "next/server";
import { beforeDeadline } from "@/lib/deadline";
import { readArchivedCoverage } from "@/lib/match-archive";
import { normalizeHDMatches } from "@/lib/match-normalize";
import { enqueueRosterHistory, rosterHistoryProgress } from "@/lib/roster-history";
import { buildEncounters, type StoredRow } from "@/lib/stored-stats";
import { profileFilterHref } from "@/lib/profile-filters";
import { encounterCoverageText } from "@/lib/encounter-coverage";
import { getLocale } from "@/lib/i18n/server";
import type { Match } from "@/lib/types";
import { MATCH_ID } from "@/lib/henrik-model";
import { EncountersTable } from "./encounters-table";
import { QueuedRefresh } from "./queued-refresh";
import { RefreshProfileButton } from "./refresh-profile-button";

export async function EncountersSection({
  visibleMatches, storedScoped, recentIds, observedAt, puuid, region, name, tag, act, played, basePath, playlist, deadline,
}: {
  visibleMatches: Match[]; storedScoped: StoredRow[]; puuid: string; region: string;
  recentIds: string[]; observedAt: number;
  name: string; tag: string; act: string; played: "with" | "against";
  basePath: string; playlist: string; deadline: number;
}) {
  const locale = await getLocale();
  const ids = [...new Set([...storedScoped.map((r) => r.id), ...visibleMatches.map((m) => m.metadata.matchid)]
    .filter((id) => MATCH_ID.test(id)))];
  // Read the entire selected scope. Fetch budgets must never cap cached evidence.
  const result = await beforeDeadline(Promise.all([
    readArchivedCoverage([...ids, ...recentIds]), rosterHistoryProgress(puuid),
  ]), deadline).catch(() => null);
  const normalized = normalizeHDMatches(result ? [...result[0].archived.values()] : []);
  const byId = new Map([...normalized.matches, ...visibleMatches]
    .filter((m) => m.players.length > 1 && m.players.some((p) => p.puuid === puuid))
    .map((m) => [m.metadata.matchid, m]));
  const covered = ids.filter((id) => byId.has(id)).length;
  const isUnavailable = (id: string) => !byId.has(id) &&
    !!(result?.[0].unavailable.has(id) || result?.[0].archived.has(id));
  const isMissing = (id: string) => !byId.has(id) && !isUnavailable(id);
  const unavailable = ids.filter(isUnavailable).length;
  const recentCovered = recentIds.filter((id) => byId.has(id)).length;
  const recentPending = recentIds.filter(isMissing).length;
  const olderMissing = ids.filter((id) => !recentIds.includes(id) && isMissing(id)).length;
  const blocked = result?.[1].blocked ?? false;
  if (result && recentIds.length && !blocked) after(async () => {
    try { await enqueueRosterHistory(puuid, region, recentIds, observedAt); }
    catch { console.warn("[encounters] history queue admission failed"); }
  });
  const playedHref = (p: "with" | "against") => profileFilterHref(basePath, "encounters", playlist, act, p);
  return (
    <>
      <QueuedRefresh active={!!result && recentPending > 0 && !blocked} maxTicks={30} />
      <p role="status" className="text-secondary text-13" style={{ padding: "4px 2px" }}>
        {encounterCoverageText(locale, {
          covered, total: ids.length, allActs: act === "all", recentTotal: recentIds.length, recentCovered,
          pending: recentPending, olderMissing, unavailable, blocked, loaded: !!result,
        })}
      </p>
      {recentPending > 0 || !result ? <RefreshProfileButton inline /> : null}
      <EncountersTable encounters={buildEncounters([...byId.values()].filter((m) => ids.includes(m.metadata.matchid)),
        name, tag, puuid)} mode={played}
        filterItems={[
          { label: "Played With", href: playedHref("with"), active: played === "with" },
          { label: "Played Against", href: playedHref("against"), active: played === "against" },
        ]}
      />
    </>
  );
}
