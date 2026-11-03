import { after } from "next/server";
import { beforeDeadline } from "@/lib/deadline";
import { readArchivedCoverage } from "@/lib/match-archive";
import { normalizeHDMatches } from "@/lib/match-normalize";
import { enqueueRosterHistory, rosterHistoryProgress } from "@/lib/roster-history";
import { buildEncounters, type StoredRow } from "@/lib/stored-stats";
import { profileFilterHref } from "@/lib/profile-filters";
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
  const L = (ja: string, en: string) => locale === "ja" ? ja : en;
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
        {L(`遭遇集計：${covered} / ${ids.length}試合`, `Encounters: ${covered} / ${ids.length} matches`)}
        {act === "all" ? L("（全期間）", " (all stored history)") : ""}
        {L(`。自動取得は全カテゴリー通算の直近${recentIds.length}試合まで（保存済み${recentCovered}試合）`,
          `. Auto-retrieval covers the latest ${recentIds.length} matches across all playlists (${recentCovered} saved)`)}
        {result && recentPending > 0 ? blocked
          ? L("。取得エラーで停止中です。", ". Retrieval is paused after an error.")
          : L(`。残り${recentPending}試合をバックグラウンドで取得します。`, `. ${recentPending} remaining recent matches await background retrieval.`)
          : ""}
        {result && olderMissing > 0 ? L(` 過去の未保存${olderMissing}試合は自動取得対象外です。`,
          ` ${olderMissing} older unsaved matches are outside automatic retrieval.`) : ""}
        {unavailable ? L(` 詳細取得不可：${unavailable}試合。`, ` Unavailable details: ${unavailable}.`) : ""}
        {!result ? L(" 保存データの読み込みに失敗しました。再試行してください。", " Archive could not be read. Please retry.") : ""}
        {L(" 未取得・取得不可は遭遇なしとは扱いません。", " Missing details do not mean no encounters.")}
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
