import Image from "next/image";
import type { AgentBreakdown } from "@/lib/types";

export function TopAgentsCard({ agents }: { agents: AgentBreakdown[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <h3 className="mb-4 text-sm font-bold">Top Agents</h3>
      <ul className="space-y-2">
        {agents.slice(0, 3).map((a) => (
          <li
            key={a.agent}
            className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 p-2.5 hover:border-border transition-colors"
          >
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md">
              <Image
                src={a.icon}
                alt={a.agent}
                fill
                className="object-cover scale-110"
                sizes="40px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{a.agent}</p>
              <p className="text-xs text-muted-foreground">{a.matches} Matches</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Win %</p>
              <p className="text-sm font-bold text-emerald-400">{a.winRate}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
