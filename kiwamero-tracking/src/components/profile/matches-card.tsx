"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Match, MatchPlayer, Profile } from "@/lib/types";
import { tierIcon } from "@/lib/henrikdev";
import {
  dayAggregate,
  deriveAgentMinis,
  deriveMatchRows,
  deriveOverview,
  groupByDay,
} from "@/lib/profile-stats";

export function MatchesCard({
  profile,
  matches,
  limit = 20,
  basePath,
  capturedAt,
  showAllLink = true,
}: {
  profile: Profile;
  matches: Match[];
  limit?: number;
  basePath: string;
  capturedAt: string;
  showAllLink?: boolean;
}) {
  const [agent, setAgent] = useState("all");
  const [map, setMap] = useState("all");
  const [mate, setMate] = useState("all");
  const [kills, setKills] = useState("all");
  const now = Date.parse(capturedAt);
  const agents = useMemo(() => {
    const values = matches.flatMap((match) =>
      match.players.filter((player) => player.puuid === profile.puuid).map((player) => player.character),
    );
    return [...new Set(values)].sort();
  }, [matches, profile.puuid]);
  const maps = useMemo(() => [...new Set(matches.map((match) => match.metadata.map))].sort(), [matches]);
  const mates = useMemo(() => {
    const names = new Set<string>();
    for (const match of matches) {
      const me = match.players.find((player) => player.puuid === profile.puuid);
      if (!me?.team_id) continue;
      for (const player of match.players) {
        if (player.puuid !== profile.puuid && player.team_id === me.team_id && player.name) {
          names.add(`${player.name}#${player.tag}`);
        }
      }
    }
    return [...names].sort();
  }, [matches, profile.puuid]);
  const filtered = useMemo(
    () =>
      matches.filter((match) => {
        const me = match.players.find((player) => player.puuid === profile.puuid);
        if (!me) return false;
        if (map !== "all" && match.metadata.map !== map) return false;
        if (agent !== "all" && me.character !== agent) return false;
        if (kills !== "all" && me.stats.kills < Number(kills)) return false;
        if (mate !== "all" && !match.players.some(
          (player) => player.puuid !== profile.puuid && player.team_id === me.team_id && `${player.name}#${player.tag}` === mate,
        )) return false;
        return true;
      }),
    [agent, map, mate, kills, matches, profile.puuid],
  );
  const rows = deriveMatchRows(filtered, profile.puuid, now).slice(0, limit);
  const groups = useMemo(() => groupByDay(rows), [rows]);
  const overview = deriveOverview(filtered, profile.puuid);
  const minis = deriveAgentMinis(filtered, profile.puuid, 3);
  const wr = overview.wins + overview.losses ? Math.round((overview.wins / (overview.wins + overview.losses)) * 100) : 0;

  return (
    <section className="kt-card" aria-label="Recent matches">
      <header className="kt-card-head">
        <h3 className="kt-card-title">Last {Math.min(limit, filtered.length)} Matches</h3>
        {showAllLink ? (
          <Link href={`${basePath}/matches`} className="kt-card-action">
            All Matches <ChevronRight size={18} />
          </Link>
        ) : null}
      </header>

      <div className="kt-card-body kt-matches-body">
        <div className="kt-mfilters" aria-label="Filter matches">
          <FilterSelect label="All Agents" value={agent} onChange={setAgent} options={agents} />
          <FilterSelect label="All Maps" value={map} onChange={setMap} options={maps} />
          <FilterSelect label="All Teammates" value={mate} onChange={setMate} options={mates} />
          <FilterSelect label="All Kills" value={kills} onChange={setKills} options={["10", "20", "25", "30", "35"]} optionLabel={(v) => `${v}+ Kills`} />
        </div>

        {rows.length ? (
          <>
            <div className="kt-gamereport">
              <div className="kt-gamereport-left">
                <div className="kt-gamereport-pill">
                  <span className="kt-gamereport-value">
                    <span className="kt-wins">{overview.wins}W</span>
                    <span className="kt-muted"> - </span>
                    <span className="kt-losses">{overview.losses}L</span>
                    <span className="kt-muted"> ({wr}%)</span>
                  </span>
                  <span className="kt-gamereport-title">
                    <span className="kt-hl">{overview.kd.toFixed(2)}</span> K/D
                    <span className="kt-muted"> | </span>
                    <span className="kt-hl">{Math.round(overview.adr)}</span> ADR
                  </span>
                </div>
              </div>
              <div className="kt-gamereport-right">
                {minis.map((mini) => (
                  <div className="kt-ministat" key={mini.agent}>
                    <Image src={mini.icon} alt={mini.agent} width={40} height={40} />
                    <div>
                      <div className="kt-title">
                        {mini.wins}W - {mini.losses}L
                        <span className="kt-muted"> ({Math.round(mini.winRate)}%)</span>
                      </div>
                      <div className="kt-sub">K/D {mini.kd.toFixed(2)}</div>
                      <div className="kt-progress">
                        <i style={{ width: `${Math.min(100, Math.max(4, mini.winRate))}%`, background: miniBarColor(mini.kd) }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="kt-timeline" aria-hidden="true">
              {rows.slice(0, 8).map((row) => (
                <div className="kt-timeline-item" data-result={row.result} key={row.matchId}>
                  <span className="kt-timeline-time">{row.ago}</span>
                  <span className="kt-timeline-score">
                    <span className="kt-won">{row.won}</span> : <span className="kt-lost">{row.lost}</span>
                  </span>
                  <span className="kt-timeline-kd">K/D {row.kd.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        <div className="kt-match-rows">
          {groups.map((group) => {
            const agg = dayAggregate(group.rows);
            return (
              <div className="kt-daygroup" key={group.day}>
                <div className="kt-daygroup-head">
                  <div className="kt-daygroup-title">
                    <span>{group.day}</span>
                    <span className="kt-daygroup-count">{group.rows.length}</span>
                    <span className="kt-daygroup-stats">
                      <span className="kt-w">{agg.wins} W</span>
                      <span>{" // "}</span>
                      <span className="kt-l">{agg.losses} L</span>
                    </span>
                  </div>
                  <div className="kt-daygroup-averages">
                    <DayStat label="K/D" value={agg.kd.toFixed(1)} />
                    <DayStat label="K/D/A" value={`${agg.kills} K // ${agg.deaths} D // ${agg.assists} A`} />
                    <DayStat label="DDΔ" value={agg.dd > 0 ? `+${agg.dd}` : String(agg.dd)} />
                    <DayStat label="HS%" value={String(agg.hs)} />
                    <DayStat label="ACS" value={String(agg.acs)} />
                  </div>
                </div>
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
          {!rows.length ? <p className="kt-match-empty">No matches for these filters.</p> : null}
        </div>
      </div>
    </section>
  );
}

function miniBarColor(kd: number) {
  if (kd >= 1.5) return "var(--kt-blue)";
  if (kd >= 1.2) return "var(--kt-green)";
  return "var(--kt-gold)";
}

function DayStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="kt-daygroup-stat">
      <span className="kt-label">{label}</span>
      <span className="kt-value">{value}</span>
    </span>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  optionLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  optionLabel?: (value: string) => string;
}) {
  return (
    <label className="kt-mfilter-wrap">
      <span className="sr-only">{label}</span>
      <select className="kt-mfilter" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="all">{label}</option>
        {options.map((option) => <option value={option} key={option}>{optionLabel ? optionLabel(option) : option}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
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
  const isDeathmatch = match.metadata.mode_id.toLowerCase() === "deathmatch";
  const team = player.team_id?.toLowerCase() as "red" | "blue" | undefined;
  const won = row.result === "win";
  const score = isDeathmatch
    ? `${row.kills} Kills`
    : `${row.won} : ${row.lost}`;
  const teamPlayers = [...match.players].sort((a, b) => {
    const aTeam = a.team_id?.toLowerCase() ?? "";
    const bTeam = b.team_id?.toLowerCase() ?? "";
    if (aTeam !== bTeam) return aTeam === team ? -1 : bTeam === team ? 1 : aTeam.localeCompare(bTeam);
    return b.stats.score - a.stats.score;
  });

  return (
    <details className={`kt-match-details kt-match-details--${row.result}`}>
      <summary className="kt-mrow">
        <span className="kt-mrow-main">
          <Image src={row.agentIcon} alt="" width={48} height={48} className="kt-mrow-agent" />
          <span className="kt-mrow-meta">
            <span className="kt-mrow-time">{row.ago}<span>{"//"}</span>{row.mode}</span>
            <span className="kt-mrow-mapline">
              <span className="kt-mrow-map">{row.map}</span>
              {row.place === "1st" ? (
                <span className="kt-mrow-place kt-mrow-place--mvp">MVP</span>
              ) : row.place !== "—" ? (
                <span className="kt-mrow-place">{row.place}</span>
              ) : null}
            </span>
          </span>
        </span>

        <span className="kt-mrow-score">
          <span className="kt-label">Score</span>
          <span className="kt-value">
            {isDeathmatch ? (
              <b>{score}</b>
            ) : (
              <>
                <b className={won ? "kt-w" : "kt-l"}>{row.won}</b>
                <span className="kt-score-separator"> : </span>
                <b className={won ? "kt-l" : "kt-w"}>{row.lost}</b>
              </>
            )}
          </span>
        </span>

        <Image src={tierIcon(player.currenttier ?? 0, "small")} alt="" width={32} height={32} className="kt-mrow-rank" />
        <Stat label="K/D" value={row.kd.toFixed(1)} />
        <Stat label="K/D/A" value={`${row.kills} / ${row.deaths} / ${row.assists}`} />
        <Stat label="DDΔ" value={row.dd > 0 ? `+${row.dd}` : String(row.dd)} />
        <Stat label="HS%" value={String(row.hs)} />
        <Stat label="ACS" value={match.metadata.rounds_played > 1 ? String(row.acs) : "—"} />
        <span className="kt-mrow-dots" aria-hidden="true"><i /><i /><i /></span>
      </summary>

      <div className="kt-match-expanded">
        <div className="kt-match-expanded-head">
          <span>{row.map} · {row.mode}</span>
          <span>{row.kills} / {row.deaths} / {row.assists}</span>
        </div>
        <div className="kt-match-scoreboard">
          {teamPlayers.map((item) => (
            <div className="kt-match-player" key={item.puuid}>
              <span className="kt-match-player-name">{item.name}<small>#{item.tag}</small></span>
              <span>{item.character}</span>
              <span>{item.stats.kills} / {item.stats.deaths} / {item.stats.assists}</span>
              <span>{item.stats.score}</span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="kt-ms">
      <span className="kt-label">{label}</span>
      <span className="kt-value">{value}</span>
    </span>
  );
}
