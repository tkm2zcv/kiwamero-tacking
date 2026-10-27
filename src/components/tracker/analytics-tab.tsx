import Image from "next/image";
import type { AgentBreakdown } from "@/lib/types";

export function AnalyticsTab({ agents }: { agents: AgentBreakdown[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="border-b border-border/50 px-5 py-3.5">
        <h3 className="text-sm font-bold">エージェント別パフォーマンス</h3>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-2.5 font-medium">Agent</th>
            <th className="px-3 py-2.5 text-right font-medium">Matches</th>
            <th className="px-3 py-2.5 text-right font-medium">W-L-D</th>
            <th className="px-3 py-2.5 text-right font-medium">Win %</th>
            <th className="px-3 py-2.5 text-right font-medium">K/D</th>
            <th className="px-5 py-2.5 text-right font-medium">ACS</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => (
            <tr key={a.agent} className="border-b border-border/30 last:border-0 hover:bg-secondary/20 transition-colors">
              <td className="px-5 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative h-8 w-8 overflow-hidden rounded-md">
                    <Image src={a.icon} alt={a.agent} fill className="object-cover scale-110" sizes="32px" />
                  </div>
                  <div>
                    <p className="font-semibold">{a.agent}</p>
                    <p className="text-[10px] text-muted-foreground">{a.name}</p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{a.matches}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {a.wins}-{a.losses}-{a.draws}
              </td>
              <td className="px-3 py-2.5 text-right font-bold tabular-nums text-emerald-400">{a.winRate}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{a.kd}</td>
              <td className="px-5 py-2.5 text-right tabular-nums">{a.acs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
