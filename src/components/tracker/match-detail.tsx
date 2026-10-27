"use client";

import Image from "next/image";
import { cn, TIER_ICON } from "@/lib/utils";
import type { Match } from "@/lib/types";

export function MatchDetail({ match, puuid }: { match: Match; puuid: string }) {
  const teams = (["Red", "Blue"] as const).map((t) => ({
    name: t,
    won: match.teams[t.toLowerCase() as "red" | "blue"].has_won,
    players: match.players.all_players.filter((p) => p.team === t),
  }));
  return (
    <div className="mt-2 grid gap-3 rounded-xl border border-border/50 bg-card p-4 md:grid-cols-2">
      {teams.map((t) => (
        <div key={t.name}>
          <p className={cn("mb-2 text-xs font-bold uppercase tracking-wider", t.won ? "text-emerald-400" : "text-red-400")}>
            {t.name} Team {t.won ? "— VICTORY" : "— DEFEAT"}
          </p>
          <ul className="space-y-1">
            {t.players
              .slice()
              .sort((x, y) => y.stats.score - x.stats.score)
              .map((p) => {
                const shots = p.stats.headshots + p.stats.bodyshots + p.stats.legshots;
                const hs = shots ? Math.round((p.stats.headshots / shots) * 100) : 0;
                const isMe = p.puuid === puuid;
                return (
                  <li
                    key={p.puuid}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-xs",
                      isMe ? "border-cyan-400/40 bg-cyan-400/10" : "border-border/40 bg-secondary/20"
                    )}
                  >
                    <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded">
                      <Image src={p.assets.agent.small} alt={p.character} fill className="object-cover" sizes="28px" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {p.name}
                        <span className="ml-1 font-normal text-muted-foreground">#{p.tag}</span>
                      </p>
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {p.character}
                        <Image src={TIER_ICON(p.currenttier)} alt="" width={12} height={12} className="h-3 w-3" />
                        {p.currenttier_patched}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px]">
                      <p className="tabular-nums">{p.stats.kills}/{p.stats.deaths}/{p.stats.assists}</p>
                      <p className="text-[10px] text-muted-foreground tabular-nums">
                        ACS {Math.round(p.stats.score / Math.max(1, match.metadata.rounds_played))} · HS {hs}%
                      </p>
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
