import Image from "next/image";
import type { SeasonRank } from "@/lib/types";

export function SeasonRanksTab({ seasons }: { seasons: SeasonRank[] }) {
  return (
    <div className="space-y-3">
      {seasons.map((s) => (
        <div
          key={s.actCode}
          className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-4 hover:border-border transition-colors"
        >
          <div className={`h-12 w-1.5 rounded-full ${s.episodeColor}`} />
          <div className="relative h-12 w-12 shrink-0">
            <Image src={s.rankIcon} alt={s.peakRank} fill className="object-contain" sizes="48px" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {s.act} <span className="ml-1 text-xs font-medium text-muted-foreground">{s.episode}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Peak {s.peakRank} · {s.playtimeHours}h · {s.games} games
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-6 text-center">
            <Mini label="WIN %" value={s.winRate} />
            <Mini label="K/D" value={s.kd} />
            <Mini label="HS%" value={s.hs} />
          </div>
          {s.topAgent && (
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <Image src={s.topAgent.icon} alt={s.topAgent.name} fill className="rounded object-cover" sizes="32px" />
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold">{s.topAgent.name}</p>
                <p className="text-[10px] text-muted-foreground">Top Agent</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}
