"use client";

import Image from "next/image";
import { useState } from "react";
import type { Match, MatchPlayer } from "@/lib/types";
import { relTime, modeLabel } from "@/lib/utils";
import { tierIcon } from "@/lib/henrikdev";
import { ChevronDown } from "lucide-react";
import { MatchDetail } from "./match-detail";

export function MatchRowClient({ match, puuid, capturedAt }: { match: Match; puuid: string; capturedAt?: string }) {
  const [open, setOpen] = useState(false);
  return <MatchRow match={match} puuid={puuid} capturedAt={capturedAt} open={open} onToggle={() => setOpen(!open)} />;
}

export function MatchRow({
  match,
  puuid,
  capturedAt,
  open,
  onToggle,
}: {
  match: Match;
  puuid: string;
  capturedAt?: string;
  open: boolean;
  onToggle: () => void;
}) {
  const me = match.players.find((p) => p.puuid === puuid) ?? match.players[0];
  const teamId = me?.team_id?.toLowerCase() as "red" | "blue" | undefined;
  const myTeam = teamId ? match.teams[teamId] : undefined;
  const oppTeam = teamId === "red" ? match.teams.blue : teamId === "blue" ? match.teams.red : undefined;
  const won = myTeam?.has_won ?? false;
  const draw = myTeam && myTeam.rounds_won === myTeam.rounds_lost;
  const isDm = match.metadata.mode_id === "deathmatch";
  const isTdm = match.metadata.mode_id === "teamdeathmatch" || match.metadata.mode_id === "team-deathmatch";

  const kills = me?.stats.kills ?? 0;
  const deaths = me?.stats.deaths ?? 0;
  const assists = me?.stats.assists ?? 0;
  const kd = deaths ? kills / deaths : kills;
  const roundBased = match.metadata.rounds_played > 1;
  const acs = roundBased ? Math.round((me?.stats.score ?? 0) / match.metadata.rounds_played) : null;
  const hsPct = hsPctOf(me);
  const adr = roundBased ? Math.round((me?.damage_made ?? 0) / match.metadata.rounds_played) : null;
  const when = relTime(match.metadata.game_start, capturedAt);
  const agent = me?.character ?? "";
  const agentIcon = `/agents/${agent.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o")}.webp`;

  // DM placement: rank by score
  let dmPlace = 0;
  if (isDm) {
    const sorted = [...match.players].sort((a, b) => b.stats.score - a.stats.score);
    dmPlace = sorted.findIndex((p) => p.puuid === me?.puuid) + 1;
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className={`match-row match-row--${won && !draw ? "win" : "loss"} w-full text-left`}
      >
        {/* agent + mode/map */}
        <div className="flex items-center gap-3 min-w-0">
          <Image src={agentIcon} alt={agent} width={44} height={44} className="size-11 rounded" />
          <div className="min-w-0">
            <div className="text-xs text-secondary truncate">
              <span>{when}</span>
              <span className="mx-1.5 opacity-40">·</span>
              <span>{modeLabel(match.metadata.mode_id)}</span>
            </div>
            <div className="truncate font-bold capitalize">
              {match.metadata.map}
              {isDm && dmPlace ? (
                <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">{dmPlace}{ord(dmPlace)}</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* score */}
        <div className="stat-block items-center">
          <span className="name">Score</span>
          <span className="value">
            {isDm ? (
              <>{kills} kills</>
            ) : isTdm ? (
              <ScorePair a={myTeam?.rounds_won} b={oppTeam?.rounds_won} />
            ) : (
              <ScorePair a={myTeam?.rounds_won} b={oppTeam?.rounds_won} />
            )}
          </span>
        </div>

        <Stat name="K/D/A" value={`${kills} / ${deaths} / ${assists}`} />
        <Stat name="KDA" value={kd.toFixed(2)} />
        <Stat name="ACS" value={acs === null ? "—" : String(acs)} />
        <div className="hidden xl:flex"><Stat name="ADR" value={adr === null ? "—" : String(adr)} /></div>
        <div className="hidden xl:flex"><Stat name="HS%" value={`${hsPct}%`} /></div>
        {me?.currenttier ? (
          <Image src={tierIcon(me.currenttier, "small")} alt="" width={36} height={36} className="hidden lg:block" />
        ) : null}
        <ChevronDown className={`size-4 text-tertiary transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? <MatchDetail match={match} puuid={puuid} /> : null}
    </div>
  );
}

function ScorePair({ a, b }: { a?: number; b?: number }) {
  if (a === undefined || b === undefined) return <>—</>;
  return (
    <span>
      <b style={{ color: a >= b ? "var(--color-valorant-team-1)" : "var(--color-valorant-team-2)" }}>{a}</b>
      <span className="text-tertiary"> - </span>
      {b}
    </span>
  );
}

function Stat({ name, value }: { name: string; value: string }) {
  return (
    <div className="stat-block items-center">
      <span className="name">{name}</span>
      <span className="value">{value}</span>
    </div>
  );
}

function hsPctOf(p?: MatchPlayer) {
  if (!p) return 0;
  const s = p.stats;
  const total = (s.headshots ?? 0) + (s.bodyshots ?? 0) + (s.legshots ?? 0);
  return total ? Math.round(((s.headshots ?? 0) / total) * 100) : 0;
}

function ord(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd"][Math.min(v % 10, 4)] ?? "th";
}
