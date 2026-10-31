import { normalizeCluster } from "./henrik-shared.ts";
import { aggregate, agentIconUrl, groupByAgent, type StatAggregate, type StoredRow } from "./stored-stats.ts";
import type { Profile } from "./types.ts";

export interface ShareCardModel {
  name: string;
  tag: string;
  level: number;
  region: string;
  server: string;
  rankName: string;
  rr: number;
  rankIconUrl: string;
  avatarUrl?: string;
  actLabel: string;
  playlistLabel: string;
  matchesAvailable: number;
  stats: StatAggregate;
}

function playlistSlug(playlist: string) {
  return playlist === "premier" ? "premier" : playlist.toLowerCase().replace(/[^a-z]/g, "");
}

function topCluster(rows: StoredRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const cluster = normalizeCluster(row.cluster);
    if (!cluster) continue;
    counts.set(cluster, (counts.get(cluster) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

function latestSeasonId(rows: StoredRow[]): string {
  return rows.reduce(
    (best, row) => row.startedAt > best.ts && row.seasonId ? { id: row.seasonId, ts: row.startedAt } : best,
    { id: "", ts: 0 },
  ).id;
}

/**
 * Build the serializable stats model for the generated share card.
 * The card is intentionally scoped to the account's current act, even when the
 * profile page is viewing an older act through the act selector.
 */
export function buildShareCardModel({
  profile,
  rows,
  playlist,
  actCode,
  actSeasonId,
  actLabel,
  cardArtUrl,
  rankIconUrl,
}: {
  profile: Profile;
  rows: StoredRow[];
  playlist: string;
  actCode?: string;
  actSeasonId?: string;
  actLabel: string;
  cardArtUrl?: string | null;
  rankIconUrl: string;
}): ShareCardModel {
  const currentAct = actCode?.toLowerCase();
  let actRows = currentAct
    ? rows.filter((row) =>
      row.seasonShort.toLowerCase() === currentAct ||
      (!!actSeasonId && row.seasonId.toLowerCase() === actSeasonId.toLowerCase())
    )
    : [];

  if (!currentAct && !actRows.length) {
    const latest = latestSeasonId(rows);
    if (latest) actRows = rows.filter((row) => row.seasonId === latest);
  }

  const selectedPlaylist = playlistSlug(playlist);
  const scoped = playlist === "all"
    ? actRows
    : actRows.filter((row) => playlistSlug(row.mode) === selectedPlaylist);
  const topAgent = groupByAgent(scoped)[0] ?? groupByAgent(actRows)[0];

  return {
    name: profile.name,
    tag: profile.tag,
    level: profile.level,
    region: profile.region.toUpperCase(),
    server: topCluster(scoped) || topCluster(actRows) || topCluster(rows) || profile.region.toUpperCase() || "—",
    rankName: profile.currentRank || "Unranked",
    rr: profile.rr,
    rankIconUrl,
    avatarUrl: topAgent ? agentIconUrl(topAgent.agent) : cardArtUrl ?? undefined,
    actLabel,
    playlistLabel: playlist === "all"
      ? "All Modes"
      : selectedPlaylist.charAt(0).toUpperCase() + selectedPlaylist.slice(1),
    matchesAvailable: scoped.length,
    stats: aggregate(scoped),
  };
}
