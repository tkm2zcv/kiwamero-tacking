"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import type { Match, MatchPlayer, Profile } from "@/lib/types";
import { tierIcon, tierName } from "@/lib/henrikdev";
import {
  agentIconUrl,
  dayAggregate,
  deriveAgentMinis,
  deriveMatchRows,
  deriveOverview,
  formatMatchTime,
  groupByDay,
} from "@/lib/profile-stats";

/** tracker.gg per-agent accent colors (--agent-color). */
const AGENT_COLORS: Record<string, string> = {
  Astra: "#7a4dd8",
  Breach: "#c97b40",
  Brimstone: "#8b5a2b",
  Chamber: "#d4af37",
  Clove: "#cba5e8",
  Cypher: "#b8a66a",
  Deadlock: "#a9c8cf",
  Fade: "#5b5070",
  Gekko: "#b7d441",
  Harbor: "#4a90b8",
  Iso: "#4b4bbf",
  Jett: "#a8e4f0",
  "KAY/O": "#4fc3f7",
  Killjoy: "#f5c542",
  Neon: "#3fe0ff",
  Omen: "#4a4a8a",
  Phoenix: "#f89c3c",
  Raze: "#f0a04b",
  Reyna: "#a63c7e",
  Sage: "#7de8c3",
  Skye: "#6fa96f",
  Sova: "#5a8fbf",
  Tejo: "#d97f4a",
  Viper: "#5fa85a",
  Vyse: "#affb9b",
  Waylay: "#98dcff",
  Yoru: "#414e94",
};

const DOTS_PATH =
  "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2";
const LOCK_PATH =
  "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2m-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2m3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1z";
const FILTER_LIST_PATH = "M10 18h4v-2h-4zM3 6v2h18V6zm3 7h12v-2H6z";
const REPORT_ICON_PATH =
  "M23 8a2.006 2.006 0 0 1-2 2 1.7 1.7 0 0 1-.51-.07l-3.56 3.55A1.8 1.8 0 0 1 17 14a2 2 0 0 1-4 0 1.8 1.8 0 0 1 .07-.52l-2.55-2.55a1.97 1.97 0 0 1-1.04 0l-4.55 4.56A1.7 1.7 0 0 1 5 16a2 2 0 1 1-2-2 1.7 1.7 0 0 1 .51.07l4.56-4.55A1.8 1.8 0 0 1 8 9a2 2 0 0 1 4 0 1.8 1.8 0 0 1-.07.52l2.55 2.55a1.97 1.97 0 0 1 1.04 0l3.55-3.56A1.7 1.7 0 0 1 19 8a2 2 0 0 1 4 0";
const PREMIUM_BADGE =
  "M12.002 16.7c-3.8 0-6.8-3-6.9-6.8 0-3.8 3.1-6.9 6.9-6.9s6.8 3 6.8 6.8c.1 3.7-2.9 6.8-6.6 6.9zM21.4 5.5c-.3-.4-.4-.9-.2-1.3l.3-.9.6.7c.3.4.4.9.2 1.3l-.2.7c-.1-.6-.2-1.2-.4-1.8.1.6.2 1.3.2 1.9zM1.9 6c.1-.6.2-1.2.4-1.8-.1.6-.2 1.3-.2 1.9l.4-.6c.4-.3.5-.8.3-1.3l-.3-.8-.6.7c-.3.4-.4.9-.2 1.4zm-.6 3.1c-.1-.6-.2-1.2-.2-1.8.1.6.2 1.2.4 1.8l.3-.8c.3-.6.2-1.2-.2-1.7L1 5.7l-.4 1c-.3.6-.2 1.2.2 1.7zm20.5 2.8.1 1.1c.5-.6.9-1.3 1.2-2-.3.8-.6 1.5-1 2.2l1-.7c.6-.4 1-1.1.9-1.8l-.1-1.4-1.2.8c-.6.4-.9 1.1-.9 1.8m.4-3.7.4.9c.2-.6.3-1.2.4-1.8 0 .6-.1 1.2-.2 1.8l.6-.8c.3-.5.4-1.1.2-1.6l-.6-1-.7.9c-.3.5-.4 1.1-.1 1.6m-18 9.1c-.9-.6-1.7-1.2-2.4-2 .9.7 1.8 1.3 2.8 1.8L4 15.7c-.3-.9-1.1-1.5-2-1.6l-1.7-.3.7 1.6c.3.9 1.1 1.5 2 1.6zm11.5 1.4-1.4 1.2c1.5 0 3.1-.2 4.6-.5-1.4.5-2.8.8-4.3.9l1.4.5c1.1.4 2.3.2 3.2-.6l1.7-1.4-1.9-.7c-1.1-.4-2.4-.2-3.3.6m4.2-3-.6 1.4c1-.5 1.9-1.1 2.8-1.8-.7.8-1.5 1.4-2.4 2l1.2-.2c.9-.1 1.7-.7 2-1.6l.7-1.6-1.6.2c-.9.2-1.7.8-2.1 1.6M5 19.4c1.5.3 3.1.5 4.6.5l-1.4-1.2c-.9-.8-2.1-1-3.2-.6l-2 .7 1.7 1.4c.9.8 2.1 1 3.2.6l1.4-.5c-1.5-.2-2.9-.5-4.3-.9m-4-6.8.9.6c-.4-.7-.8-1.4-1-2.2.3.7.7 1.4 1.2 2l.1-1c0-.8-.3-1.5-1-2L.1 9.3 0 10.6c0 .8.3 1.5 1 2m11 6.9c-.3 0-.6.2-.6.6 0 .3.3.6.6.6s.6-.3.6-.6-.2-.6-.6-.6";
const PREMIUM_BADGE_P =
  "M15.4 8.8c-.1.4-.3.8-.5 1.1s-.5.5-.8.7-.7.3-1 .4c-.4.1-.8.1-1.2.1H11l-.5 2.4H8.7l1.5-7.1H13c.4 0 .7 0 1.1.1.3.1.6.2.9.4.2.2.4.4.5.7 0 .4 0 .8-.1 1.2m-1.8 0v-.4c0-.1-.1-.2-.2-.3-.2 0-.3-.1-.5-.1h-1.3l-.4 1.8h1.3c.2 0 .3-.1.5-.1.1-.1.3-.2.4-.3.1-.2.1-.4.2-.6";

export function MatchesCard({
  profile,
  matches,
  limit = 20,
  basePath,
  capturedAt,
  showAllLink = true,
  bare = false,
}: {
  profile: Profile;
  matches: Match[];
  limit?: number;
  basePath: string;
  capturedAt: string;
  showAllLink?: boolean;
  bare?: boolean;
}) {
  const [agent, setAgent] = useState("all");
  const [map, setMap] = useState("all");
  const now = Date.parse(capturedAt);
  const agents = useMemo(() => {
    const values = matches.flatMap((match) =>
      match.players.filter((player) => player.puuid === profile.puuid).map((player) => player.character),
    );
    return [...new Set(values)].sort();
  }, [matches, profile.puuid]);
  const maps = useMemo(() => [...new Set(matches.map((match) => match.metadata.map))].sort(), [matches]);
  const filtered = useMemo(
    () =>
      matches.filter((match) => {
        const me = match.players.find((player) => player.puuid === profile.puuid);
        if (!me) return false;
        if (map !== "all" && match.metadata.map !== map) return false;
        if (agent !== "all" && me.character !== agent) return false;
        return true;
      }),
    [agent, map, matches, profile.puuid],
  );
  const rows = deriveMatchRows(filtered, profile.puuid, now).slice(0, limit);
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const overview = deriveOverview(filtered, profile.puuid);
  const minis = deriveAgentMinis(filtered, profile.puuid, 3);
  const wr = overview.wins + overview.losses ? Math.round((overview.wins / (overview.wins + overview.losses)) * 100) : 0;

  return (
    <section className="v3-card" aria-label="Recent matches">
      <header className="v3-card__header">
        <h3 className="v3-card__title"> Last {Math.min(limit, filtered.length)} Matches</h3>
        {showAllLink ? (
          <Link href={`${basePath}/matches`} className="v3-card__header-action">
            All Matches <ChevronRight size={16} />
          </Link>
        ) : null}
      </header>

      {!bare ? (
        <div className="v3-card__filters">
          <div className="filters -mb-6 -ml-4 flex select-none items-center gap-4 overflow-auto pb-6 pl-4 font-medium no-scrollbar">
            <FilterSelect label="All Agents" value={agent} onChange={setAgent} options={agents} />
            <FilterSelect label="All Maps" value={map} onChange={setMap} options={maps} />
            <div className="-ml-2 flex items-center gap-5 rounded-3 border border-gold/50 p-2 pr-4">
              <div className="flex flex-nowrap items-center gap-5 whitespace-nowrap">
                {["All Weapons", "All Teammates", "All Dates", "All Kills"].map((label) => (
                  <div className="v3-filter v3-filter--gold" key={label} title="Premium filter">
                    <span>{label}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="text-current">
                      <path fill="currentColor" d={LOCK_PATH} />
                    </svg>
                  </div>
                ))}
                <div className="grid h-full">
                  <div className="flex cursor-pointer items-center gap-1 whitespace-nowrap pl-5 text-14 font-medium text-gold" title="Premium filters">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-6">
                      <path fill="currentColor" d={FILTER_LIST_PATH} />
                    </svg>
                    <span>+4 More</span>
                  </div>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-6 shrink-0 cursor-pointer text-gold">
                <g>
                  <path fill="currentColor" d={PREMIUM_BADGE} />
                  <path fill="#000" d={PREMIUM_BADGE_P} />
                </g>
              </svg>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 overflow-hidden">
        {!bare && rows.length ? (
          <>
            <div className="v3-card__body v3-card__body--v2.5 min-h-23">
              <div className="trn-gamereport-stats rounded-4">
                <div className="left">
                  <div className="trn-gamereport-stats__stat trn-gamereport-stats__stat--wide">
                    <div className="text-container">
                      <div className="value">
                        <span className="wins">{overview.wins}W</span> - <span className="losses">{overview.losses}L</span>{" "}
                        <span className="muted">({wr}%)</span>
                      </div>
                      <div className="title">
                        <span className="highlight">{overview.kd.toFixed(2)} K/D</span> |{" "}
                        <span className="highlight">{Math.round(overview.adr)} ADR</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="right">
                  {minis.map((mini) => (
                    <div
                      className="trn-gamereport-stats__mini-stat"
                      style={{ ["--agent-color" as string]: AGENT_COLORS[mini.agent] ?? "var(--color-accent)" }}
                      key={mini.agent}
                    >
                      <div>
                        <Image src={mini.icon} alt={mini.agent} width={40} height={40} loading="lazy" />
                      </div>
                      <div>
                        <div className="title">
                          {mini.wins}W - {mini.losses}L <span className="muted">({Math.round(mini.winRate)}%)</span>
                        </div>
                        <div className="subtitle"> K/D {mini.kd.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="v3-card__body v3-card__body--v2.5 min-h-25 overflow-auto">
              <div className="flex flex-nowrap overflow-auto rounded-4 bg-surface-2">
                {rows.map((row) => (
                  <div
                    className={`timeline-match flex-1${row.result === "win" ? " timeline-match--win" : ""}`}
                    key={row.matchId}
                  >
                    <span className="timeline-match__timestamp">
                      <span>{row.ago}</span>
                    </span>
                    <span className="timeline-match__score">
                      <span className="timeline-match__score--winner">{row.won}</span> :{" "}
                      <span className="timeline-match__score--loser">{row.lost}</span>
                    </span>
                    <span className="timeline-match__kd"> K/D {row.kd.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        <div className="v3-card__body mt-2">
          <div className="v3-mrows">
            {groups.map((group, groupIndex) => {
              const agg = dayAggregate(group.rows);
              return (
                <div className="v3-mday" key={group.day}>
                  <header className="v3-mday-head">
                    <div className="flex items-center gap-8" style={{ gridColumn: "span 2" }}>
                      <div className="flex items-center gap-4">
                        <div className="text-18 font-bold text-secondary">{group.day}</div>
                        <span className="v3-chip font-bold">{group.rows.length}</span>
                      </div>
                      {groupIndex === 0 ? (
                        <button type="button" className="trn-button trn-button--text" title="Daily report">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="trn-button__icon">
                            <path fill="currentColor" d={REPORT_ICON_PATH} />
                          </svg>
                          <span className="trn-button__label">View Report</span>
                        </button>
                      ) : null}
                    </div>
                    <div className="stat-list inline-flex max-w-full overflow-hidden font-medium v3-separate text-center text-18 v3-separate-secondary v3-stat-center">
                      <span className="value text-green truncate">{agg.wins} W</span>
                      <span className="value text-red truncate">{agg.losses} L</span>
                    </div>
                    <StatVer name="K/D" value={agg.kd.toFixed(1)} style={{ gridColumnStart: -7 }} />
                    <div className="stat-hor inline-grid gap-x-4 gap-y-0.5 truncate">
                      <div className="name-value inline-flex items-center gap-x-space order-last flex-row-reverse max-w-full overflow-hidden">
                        <span className="stat-name inline-flex max-w-full overflow-hidden">
                          <span className="truncate">K/D/A</span>
                        </span>
                        <span className="stat-value inline-flex gap-0.5 value">
                          <span>{((agg.kills + agg.assists) / (agg.deaths || 1)).toFixed(2)}</span>
                        </span>
                      </div>
                      <div className="stat-list inline-flex max-w-full overflow-hidden font-medium v3-separate substats text-secondary text-12">
                        <span className="value truncate">{agg.kills} K</span>
                        <span className="value truncate">{agg.deaths} D</span>
                        <span className="value truncate">{agg.assists} A</span>
                      </div>
                    </div>
                    <StatVer name="DDΔ" value={String(agg.dd)} />
                    <StatVer name="ADR" value={agg.adr ? agg.adr.toFixed(1) : "—"} />
                    <StatVer name="HS%" value={String(agg.hs)} />
                    <StatVer name="ACS" value={String(agg.acs)} />
                  </header>
                  {group.rows.map((row) => {
                    const match = filtered.find((item) => item.metadata.matchid === row.matchId);
                    if (!match) return null;
                    const player = match.players.find((item) => item.puuid === profile.puuid);
                    if (!player) return null;
                    return <MatchRow key={row.matchId} match={match} player={player} row={row} />;
                  })}
                </div>
              );
            })}
          </div>
          {!rows.length ? <p className="text-secondary text-14" style={{ padding: "0.5rem" }}>No matches for these filters.</p> : null}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="v3-filter" style={{ position: "relative" }}>
      <span>{value === "all" ? label : value}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%" }}
      >
        <option value="all">{label}</option>
        {options.map((option) => (
          <option value={option} key={option}>
            {option}
          </option>
        ))}
      </select>
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="text-current">
        <path fill="currentColor" d={DOTS_PATH} />
      </svg>
    </label>
  );
}

function StatVer({
  name,
  value,
  className = "",
  style,
}: {
  name: string;
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`stat-ver inline-flex items-center gap-x-2 truncate ${className}`} style={style}>
      <div className="name-value flex gap-x-space flex-col truncate">
        <span className="stat-name inline-flex max-w-full overflow-hidden mb-0.5">
          <span className="truncate">{name}</span>
        </span>
        <div className="flex max-w-full items-center gap-2">
          <span className="stat-value inline-flex gap-0.5 value truncate">
            <span className="truncate">{value}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function kdTier(kd: number): string {
  if (kd >= 2) return "v3-tier-s";
  if (kd >= 1.4) return "v3-tier-a";
  if (kd >= 1.1) return "v3-tier-b";
  if (kd >= 0.9) return "v3-tier-c";
  return "v3-tier-d";
}

function MatchRow({
  match,
  player,
  row,
}: {
  match: Match;
  player: MatchPlayer;
  row: ReturnType<typeof deriveMatchRows>[number];
}) {
  const [open, setOpen] = useState(false);
  const isDeathmatch = match.metadata.mode_id.toLowerCase() === "deathmatch";
  const team = player.team_id?.toLowerCase() as "red" | "blue" | undefined;
  const resultClass =
    row.result === "win" ? "v3-match-row--win" : row.result === "loss" ? "v3-match-row--loss" : "";
  const rowClass =
    row.place === "1st" && isDeathmatch
      ? "v3-match-row--1st"
      : row.place === "2nd" && isDeathmatch
        ? "v3-match-row--2nd"
        : resultClass;

  return (
    <div
      className={`v3-match-row group min-h-18 ${rowClass}`}
      role="button"
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
      {/* col 1 — agent + map/mode */}
      <div className="flex items-center gap-4">
        <Image
          className="rounded size-12"
          src={row.agentIcon}
          alt={row.agent}
          width={48}
          height={48}
          loading="lazy"
        />
        <div className="flex flex-col">
          <div className="text-12 font-medium leading-5/4 text-secondary v3-separate">
            <span>{formatMatchTime(row.startedAt)}</span>
            <span>
              <span>{row.mode}</span>
            </span>
          </div>
          <span className="inline-flex items-center gap-2 text-16 font-bold capitalize text-primary text-18">
            {row.map}{" "}
            {row.place === "1st" ? (
              <span className="v3-chip v3-chip--sm border-gold-1 text-black bg-gradient-gold bg-gradient-to-gold">MVP</span>
            ) : row.place !== "—" && row.place !== "1st" ? (
              <span className="v3-chip v3-chip--sm text-silver">{row.place}</span>
            ) : null}
            <ServerChip cluster={match.metadata.cluster} />
          </span>
        </div>
      </div>

      {/* col 2 — rank icon */}
      <div className="flex size-8">
        <div className="stat-imo inline-flex items-center v3-stat-image-8">
          <div className="image-wrapper flex items-center gap-x-2 gap-y-1">
            <Image
              className="image object-contain"
              src={tierIcon(player.currenttier ?? 0, "small")}
              alt={player.currenttier_patched ?? ""}
              width={80}
              height={80}
              loading="lazy"
            />
          </div>
        </div>
      </div>

      {/* col 3 — score */}
      <div className="flex justify-center">
        <div className="stat-ver inline-flex items-center gap-x-2 v3-stat-center v3-stat-left truncate">
          <div className="name-value flex gap-x-space flex-col truncate">
            <span className="name">
              <span>Score</span>
            </span>
            <div className="flex max-w-full items-center gap-2">
              <span className="value inline-flex items-center gap-space">
                {isDeathmatch ? (
                  <span>{row.kills} Kills</span>
                ) : (
                  <>
                    <span className="text-valorant-team-1">{row.won}</span> :{" "}
                    <span className="text-valorant-team-2">{row.lost}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* col 4 — TRS (tracker.gg proprietary score; not computable from our data) */}
      <div className="flex">
        <div className="stat-ver inline-flex items-center gap-x-2 v3-stat-left truncate">
          <div className="name-value flex gap-x-space flex-col truncate">
            <span className="stat-name inline-flex max-w-full overflow-hidden mb-0.5">
              <span className="truncate">TRS</span>
            </span>
            <div className="flex max-w-full items-center gap-2">
              <span className="stat-value inline-flex gap-0.5 value truncate">
                <span className="truncate text-tertiary">—</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* col 5 — multikill tags (not computable) */}
      <div className="flex gap-1" />

      {/* cols 6-10 — stats */}
      <StatVer name="K/D" value={row.kd.toFixed(1)} className={`tie ${kdTier(row.kd)}`} />
      <div className="stat-ver inline-flex items-center gap-x-2 truncate">
        <div className="name-value flex gap-x-space flex-col truncate">
          <span className="stat-name inline-flex max-w-full overflow-hidden mb-0.5">
            <span className="truncate">K/D/A</span>
          </span>
          <div className="flex max-w-full items-center gap-2">
            <div className="stat-list inline-flex max-w-full overflow-hidden font-medium v3-separate stat-value value v3-separate-slash v3-separate-secondary">
              <span className="value truncate">{row.kills}</span>
              <span className="value truncate">{row.deaths}</span>
              <span className="value truncate">{row.assists}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <StatVer name="DDΔ" value={String(row.dd)} />
      </div>
      <div className="flex justify-end">
        <StatVer name="ADR" value={row.adr ? row.adr.toFixed(1) : "—"} />
      </div>
      <div className="flex justify-end">
        <StatVer name="HS%" value={String(row.hs)} />
      </div>
      <StatVer name="ACS" value={match.metadata.rounds_played > 1 ? String(row.acs) : "—"} />

      {/* col 11 — external link to the tracker.gg match page */}
      <a
        href={`https://tracker.gg/valorant/match/${match.metadata.matchid}`}
        target="_blank"
        rel="noreferrer"
        title="View on tracker.gg"
        className="v3-match-row__dots -ml-2 inline-flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={16} />
      </a>

      {open ? (
        <div className="v3-mrow-drawer" onClick={(e) => e.stopPropagation()}>
          <LazyMatchScoreboard match={match} selfPuuid={player.puuid} selfTeam={team} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Stored-history rows carry a self-only roster; fetch the full match detail on
 * expand so old matches get the same scoreboard as recent ones. Cached detail
 * renders near-instantly; a cold fetch shows a lightweight loading line.
 */
function LazyMatchScoreboard({
  match,
  selfPuuid,
  selfTeam,
}: {
  match: Match;
  selfPuuid: string;
  selfTeam?: "red" | "blue";
}) {
  const needsDetail = match.players.length <= 1;
  const [detail, setDetail] = useState<Match | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!needsDetail) return;
    let dead = false;
    fetch(`/api/valorant/match/${match.metadata.matchid}`)
      .then((r) => (r.ok ? (r.json() as Promise<Match>) : Promise.reject(new Error(String(r.status)))))
      .then((m) => { if (!dead) setDetail(m); })
      .catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, [needsDetail, match.metadata.matchid]);
  return (
    <>
      {needsDetail && !detail && !failed ? (
        <div style={{ padding: "10px 4px", fontSize: 13, color: "var(--kt-dim)" }}>
          Loading scoreboard…
        </div>
      ) : null}
      <MatchScoreboard match={detail ?? match} selfPuuid={selfPuuid} selfTeam={selfTeam} />
    </>
  );
}

/** Compact version of tracker.gg's match-report scoreboard. */
/** VALORANT server cluster (HenrikDev city name) → flag country code; label is the city itself. */
const SERVER_CC: Record<string, string> = {
  "Tokyo": "jp", "Hong Kong": "hk", "Singapore": "sg", "Sydney": "au", "Manila": "ph",
  "Mumbai": "in", "Seoul": "kr", "Bahrain": "bh",
  "Oregon": "us", "Portland": "us", "Los Angeles": "us", "Salt Lake City": "us", "Denver": "us",
  "Dallas": "us", "Chicago": "us", "Atlanta": "us", "Ashburn": "us", "Miami": "us",
  "Sao Paulo": "br", "Mexico City": "mx", "Santiago": "cl", "Bogota": "co",
  "Frankfurt": "de", "London": "gb", "Paris": "fr", "Madrid": "es", "Stockholm": "se",
  "Warsaw": "pl", "Istanbul": "tr",
};

function ServerChip({ cluster }: { cluster: string }) {
  if (!cluster) return null;
  const cc = SERVER_CC[cluster];
  return (
    <span className="v3-chip v3-chip--sm inline-flex items-center gap-1 text-secondary" title={`Server: ${cluster}`}>
      {cc ? (
        // eslint-disable-next-line @next/next/no-img-element -- flagcdn has no config entry; plain img keeps it simple
        <img src={`https://flagcdn.com/w20/${cc}.png`} alt={cluster} width={14} height={10} className="rounded-[1px]" loading="lazy" />
      ) : null}
      {cluster}
    </span>
  );
}

/** tracker.gg match-report columns; TRS/KAST/FK/FD/MK are not derivable from our data. */
const SB_COLS = [
  ["Match Rank", "5rem"],
  ["ACS", "4rem"],
  ["K", "2.75rem"],
  ["D", "2.75rem"],
  ["A", "2.75rem"],
  ["+/-", "3.5rem"],
  ["K/D", "4rem"],
  ["DDΔ", "4rem"],
  ["ADR", "4.5rem"],
  ["HS%", "4rem"],
] as const;

function MatchScoreboard({
  match,
  selfPuuid,
  selfTeam,
}: {
  match: Match;
  selfPuuid: string;
  selfTeam?: "red" | "blue";
}) {
  // Party markers: party_id groups of 2+ get a numbered color tag
  // (st-entry-party--1..6), assigned in first-appearance order like tracker.gg.
  const partyIndex = new Map<string, number>();
  {
    const counts = new Map<string, number>();
    for (const p of match.players) {
      if (p.party_id) counts.set(p.party_id, (counts.get(p.party_id) ?? 0) + 1);
    }
    for (const p of match.players) {
      if (p.party_id && (counts.get(p.party_id) ?? 0) >= 2 && !partyIndex.has(p.party_id)) {
        partyIndex.set(p.party_id, (partyIndex.size % 6) + 1);
      }
    }
  }

  const grouped = new Map<string, MatchPlayer[]>();
  for (const p of match.players) {
    const key = p.team_id?.toLowerCase() ?? "ffa";
    grouped.set(key, [...(grouped.get(key) ?? []), p]);
  }
  const teamKeys = [...grouped.keys()].sort((a, b) => {
    if (selfTeam) {
      if (a === selfTeam) return -1;
      if (b === selfTeam) return 1;
    }
    return a === "red" ? -1 : b === "red" ? 1 : a.localeCompare(b);
  });
  const rounds = Math.max(1, match.metadata.rounds_played || 1);
  const redWon = match.teams.red?.rounds_won ?? 0;
  const blueWon = match.teams.blue?.rounds_won ?? 0;
  const score = teamKeys.length === 2 && !teamKeys.includes("ffa")
    ? `${teamKeys[0] === "red" ? redWon : blueWon} : ${teamKeys[0] === "red" ? blueWon : redWon}`
    : null;
  const allTiers = match.players.map((p) => p.currenttier ?? 0).filter((t) => t > 0);
  const overallTier = allTiers.length ? Math.round(allTiers.reduce((s, t) => s + t, 0) / allTiers.length) : 0;
  const started = match.metadata.game_start ? new Date(match.metadata.game_start * 1000) : null;
  const minutes = match.metadata.game_length ? Math.floor(match.metadata.game_length / 60) : 0;
  const seconds = match.metadata.game_length ? match.metadata.game_length % 60 : 0;

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* tracker.gg match header: mode · map · score · date · duration · avg rank */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-13" style={{ color: "var(--kt-dim)" }}>
        <span className="font-bold capitalize text-primary">{match.metadata.mode || match.metadata.mode_id}</span>
        <span className="capitalize">{match.metadata.map}</span>
        {score ? <span className="font-bold text-primary">{score}</span> : null}
        <ServerChip cluster={match.metadata.cluster} />
        {started ? <span>{started.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })}</span> : null}
        {minutes ? <span>{minutes}m {String(seconds).padStart(2, "0")}s</span> : null}
        {overallTier ? (
          <span className="inline-flex items-center gap-1">
            Average Rank:
            <Image className="size-4" src={tierIcon(overallTier, "small")} alt={tierName(overallTier)} width={16} height={16} unoptimized />
            <span className="text-primary">{tierName(overallTier)}</span>
          </span>
        ) : null}
      </div>
      {teamKeys.map((key, i) => {
        const players = [...(grouped.get(key) ?? [])].sort((a, b) => b.stats.score - a.stats.score);
        const tiers = players.map((p) => p.currenttier ?? 0).filter((t) => t > 0);
        const avgTier = tiers.length ? Math.round(tiers.reduce((s, t) => s + t, 0) / tiers.length) : 0;
        const isTwoTeam = teamKeys.length === 2 && key !== "ffa";
        const teamClass = key === "red" ? "st-valorant-team-Red" : key === "blue" ? "st-valorant-team-Blue" : "st-valorant-team-ffa";
        const teamScore = key === "red" ? redWon : key === "blue" ? blueWon : null;
        const label = isTwoTeam ? (i === 0 ? "Team A" : "Team B") : "Players";
        return (
          <div key={key} className={`st st-valorant st-valorant-team ${teamClass} st--scroll`}>
            <div className="st-header">
              <div className="st__item st-header__item st__item--sticky st__item--wide" style={{ "--st-base-width": "12rem" } as CSSProperties}>
                <span className="label flex flex-row items-center gap-2">
                  <span>{label}</span>
                  {teamScore != null ? <span className="text-primary">{teamScore}</span> : null}
                  {avgTier ? (
                    <>
                      <span>·</span>
                      <span className="flex flex-row items-center gap-1">
                        <span>Avg. Rank:</span>
                        <Image className="size-4" src={tierIcon(avgTier, "small")} alt={tierName(avgTier)} width={16} height={16} unoptimized />
                        <span>{tierName(avgTier)}</span>
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
              {SB_COLS.map(([col, w]) => (
                <div key={col} className="st__item st-header__item st-header__item--align-center st__item--align-center" style={{ "--st-base-width": w } as CSSProperties}>
                  <span className="label">{col}</span>
                </div>
              ))}
            </div>
            <div className="st-content">
              <div className="st-content__category">
                {players.map((p) => {
                  const k = p.stats.kills;
                  const d = p.stats.deaths;
                  const a = p.stats.assists;
                  const kd = d ? k / d : k;
                  const pm = k - d;
                  const dmgMade = p.damage_made ?? 0;
                  const ddd = Math.round((dmgMade - (p.damage_received ?? 0)) / rounds);
                  const shots = (p.stats.headshots ?? 0) + (p.stats.bodyshots ?? 0) + (p.stats.legshots ?? 0);
                  const party = p.party_id ? partyIndex.get(p.party_id) : undefined;
                  const isSelf = p.puuid === selfPuuid;
                  return (
                    <div className="st-content__item" key={p.puuid}>
                      <div
                        className={`st__item st-content__item-value st__item--sticky st__item--wide${isSelf ? " st-entry-current-player" : ""}`}
                        style={{ "--st-base-width": "12rem" } as CSSProperties}
                      >
                        <div className={`st-custom-name${party ? ` st-entry-party st-entry-party--${party}` : ""} flex flex-row gap-2 items-center`}>
                          <div className="image">
                            <Image src={p.assets?.agent?.small ?? agentIconUrl(p.character)} alt={p.character} width={40} height={40} loading="lazy" />
                            {p.level ? (
                              <div className="level-box">
                                <span>{p.level}</span>
                              </div>
                            ) : null}
                          </div>
                          <Link className="info" href={`/valorant/profile/riot/${encodeURIComponent(`${p.name}#${p.tag}`)}?playlist=competitive`}>
                            <span className="trn-ign">
                              <span className="trn-ign__username fit-long-username">{p.name}</span>
                              <span className="trn-ign__discriminator"> #{p.tag}</span>
                            </span>
                            <div className="rank">
                              {p.currenttier ? (
                                <Image src={tierIcon(p.currenttier, "small")} alt="" width={10} height={10} loading="lazy" unoptimized />
                              ) : null}
                              <span>{p.currenttier_patched || tierName(p.currenttier ?? 0) || "Unrated"}</span>
                            </div>
                          </Link>
                        </div>
                      </div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[0][1] } as CSSProperties}>
                        {p.currenttier ? (
                          <Image src={tierIcon(p.currenttier, "small")} alt={tierName(p.currenttier)} width={28} height={28} loading="lazy" unoptimized />
                        ) : "—"}
                      </div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[1][1] } as CSSProperties}>
                        <span className="font-bold">{Math.round(p.stats.score / rounds)}</span>
                      </div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[2][1] } as CSSProperties}>{k}</div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[3][1] } as CSSProperties}>{d}</div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[4][1] } as CSSProperties}>{a}</div>
                      <div
                        className={`st__item st-content__item-value st__item--align-center${pm >= 0 ? " value--positive" : " value--negative"}`}
                        style={{ "--st-base-width": SB_COLS[5][1] } as CSSProperties}
                      >
                        {pm >= 0 ? `+${pm}` : pm}
                      </div>
                      <div
                        className={`st__item st-content__item-value st__item--align-center${kd >= 1 ? " value--positive" : " value--negative"}`}
                        style={{ "--st-base-width": SB_COLS[6][1] } as CSSProperties}
                      >
                        {kd.toFixed(1)}
                      </div>
                      <div
                        className={`st__item st-content__item-value st__item--align-center${ddd >= 0 ? " value--positive" : " value--negative"}`}
                        style={{ "--st-base-width": SB_COLS[7][1] } as CSSProperties}
                      >
                        {ddd >= 0 ? `+${ddd}` : ddd}
                      </div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[8][1] } as CSSProperties}>
                        {(dmgMade / rounds).toFixed(1)}
                      </div>
                      <div className="st__item st-content__item-value st__item--align-center" style={{ "--st-base-width": SB_COLS[9][1] } as CSSProperties}>
                        {shots ? `${Math.round(((p.stats.headshots ?? 0) / shots) * 100)}%` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
