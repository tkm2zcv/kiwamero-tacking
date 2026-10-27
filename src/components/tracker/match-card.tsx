"use client";

import { useState } from "react";
import Image from "next/image";
import { Share2, ChevronDown } from "lucide-react";
import { cn, MAP_IMAGE, TIER_ICON, kdrColor, relTime, fmtDate } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { MatchDetail } from "./match-detail";

interface Props {
  match: Match;
  puuid: string;
  capturedAt: number;
}

export function MatchCard({ match, puuid, capturedAt }: Props) {
  const [open, setOpen] = useState(false);
  const me = match.players.all_players.find((p) => p.puuid === puuid);
  const meta = match.metadata;
  const isDM = meta.mode === "Deathmatch" || meta.mode_id === "deathmatch";
  const isTDM = meta.mode === "Team Deathmatch";

  const myTeam = (me?.team ?? "Red").toLowerCase() as "red" | "blue";
  const enemyTeam = myTeam === "red" ? "blue" : "red";
  const won = isDM ? false : match.teams[myTeam]?.has_won ?? false;
  const myRounds = match.teams[myTeam]?.rounds_won ?? 0;
  const enemyRounds = match.teams[enemyTeam]?.rounds_won ?? 0;
  const result = isDM
    ? "Finish Pos"
    : isTDM
      ? won ? "Team Victory" : "Team Defeat"
      : won ? "VICTORY" : "DEFEAT";

  const k = me?.stats.kills ?? 0;
  const d = me?.stats.deaths ?? 0;
  const a = me?.stats.assists ?? 0;
  const kdr = d > 0 ? k / d : k;
  const shots = (me?.stats.headshots ?? 0) + (me?.stats.bodyshots ?? 0) + (me?.stats.legshots ?? 0);
  const hsPct = shots > 0 ? Math.round(((me?.stats.headshots ?? 0) / shots) * 100) : 0;
  const acs = Math.round((me?.stats.score ?? 0) / Math.max(1, meta.rounds_played));
  const tierRange = tierRangeOf(match);
  const accent = isDM ? "bg-cyan-400" : won ? "bg-emerald-400" : "bg-red-400";

  return (
    <div data-state={open ? "open" : "closed"} className="group mb-4 w-full">
      <div
        onClick={() => setOpen(!open)}
        className="border-border/50 group-hover:border-primary/30 relative min-h-[110px] sm:h-[100px] w-full overflow-hidden border transition-all duration-200 hover:shadow-lg cursor-pointer rounded-xl"
      >
        <div className="absolute inset-0 z-0">
          <Image
            src={MAP_IMAGE(meta.map)}
            alt={meta.map}
            fill
            sizes="100vw"
            className="scale-105 object-cover brightness-[0.3] transition-all duration-300 group-hover:brightness-[0.35]"
          />
          <div className="via-background/80 absolute inset-0 bg-gradient-to-r to-transparent" />
        </div>
        <div className={cn("absolute inset-y-0 left-0 z-10 w-1", accent)} />
        <div className="relative z-10 flex h-full min-h-[100px] items-center gap-4 px-5 py-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/10">
            {me && (
              <Image src={me.assets.agent.small} alt={me.character} fill className="object-cover scale-110" sizes="56px" />
            )}
          </div>
          <div className="min-w-[110px]">
            <p className="text-base font-bold leading-tight">{meta.map}</p>
            <p className="text-xs text-muted-foreground">
              {meta.mode} · <span className="text-cyan-400/90">{meta.cluster}</span>
            </p>
            {tierRange && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" />
                ロビー: {tierRange}
              </p>
            )}
          </div>
          <div className="min-w-[90px] text-center">
            <p className="text-lg font-black tabular-nums">
              {isDM ? (
                <span className="text-foreground">{finishPos(match, puuid)}</span>
              ) : (
                <>
                  <span className={won ? "text-emerald-400" : "text-red-400"}>{myRounds}</span>
                  <span className="text-muted-foreground/70 mx-0.5 font-normal">:</span>
                  <span className={won ? "text-red-400" : "text-emerald-400"}>{enemyRounds}</span>
                </>
              )}
            </p>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider", won || isDM ? "text-emerald-400" : "text-red-400")}>
              {result}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-5 text-center sm:gap-7">
            <StatCell label="KDA" value={`${k}/${d}/${a}`} />
            <StatCell label="KDR" value={kdr.toFixed(2)} valueClass={kdrColor(kdr)} />
            {isDM ? (
              <StatCell label="SCORE" value={`${k} - ${runnerUpKills(match, puuid)}`} />
            ) : (
              <>
                <StatCell label="ACS" value={isTDM ? String(me?.stats.score ?? 0) : String(acs)} />
                <StatCell label="HS%" value={`${hsPct}%`} />
              </>
            )}
            {!isDM && me && (
              <div className="flex flex-col items-center gap-0.5">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">Rank</p>
                <Image src={TIER_ICON(me.currenttier)} alt={me.currenttier_patched} width={20} height={20} className="h-5 w-5 object-contain drop-shadow-md opacity-90" />
              </div>
            )}
          </div>
          <div className="flex w-20 shrink-0 flex-col items-end gap-1.5 text-right">
            <p className="text-xs font-semibold tabular-nums">{fmtDate(meta.game_start)}</p>
            <p className="text-[10px] text-muted-foreground">{relTime(meta.game_start, capturedAt)}</p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => e.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="共有"
              >
                <Share2 className="h-3.5 w-3.5" />
              </button>
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/40">
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
              </span>
            </div>
          </div>
        </div>
      </div>
      {open && <MatchDetail match={match} puuid={puuid} />}
    </div>
  );
}

function StatCell({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-bold tabular-nums", valueClass)}>{value}</p>
    </div>
  );
}

function finishPos(match: Match, puuid: string): string {
  const sorted = match.players.all_players
    .slice()
    .sort((a, b) => b.stats.score - a.stats.score);
  const pos = sorted.findIndex((p) => p.puuid === puuid) + 1;
  const sfx = pos === 1 ? "st" : pos === 2 ? "nd" : pos === 3 ? "rd" : "th";
  return `${pos}${sfx}`;
}

function runnerUpKills(match: Match, puuid: string): number {
  const others = match.players.all_players.filter((p) => p.puuid !== puuid);
  return Math.max(0, ...others.map((p) => p.stats.kills));
}

function tierRangeOf(match: Match): string | null {
  if (match.metadata.mode !== "Competitive" && match.metadata.mode_id !== "competitive") return null;
  const tiers = match.players.all_players
    .map((p) => p.currenttier)
    .filter((t) => t > 0)
    .sort((x, y) => x - y);
  const nameOf = (t: number) =>
    match.players.all_players.find((p) => p.currenttier === t)?.currenttier_patched ?? "";
  if (!tiers.length || !nameOf(tiers[0])) return null;
  const short = (t: number) =>
    nameOf(t)
      .replace("Immortal", "Immo")
      .replace("Ascendant", "Asc")
      .replace("Diamond", "Dia")
      .replace("Platinum", "Plat");
  const median = tiers[Math.floor(tiers.length / 2)];
  return `${short(median)} (${short(tiers[0])} 〜 ${short(tiers[tiers.length - 1])})`;
}
