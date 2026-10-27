import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import type { TopAgent } from "@/lib/types";

export async function TopAgentsCard({ agents }: { agents: TopAgent[] }) {
  const t = await getDict();
  return (
    <div className="trn-card p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-tertiary">{t.side.topAgents}</h3>
      <div className="space-y-1">
        {agents.slice(0, 5).map((a) => (
          <div key={a.agent} className="flex items-center gap-3 rounded p-1.5 hover:bg-white/5">
            <Image src={a.icon} alt={a.agent} width={36} height={36} className="rounded" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{a.agent}</div>
              <div className="text-xs text-tertiary">{a.matches} {t.side.matchesPlayed}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold" style={{ color: "var(--color-valorant-team-1)" }}>
                {String(a.winRate).replace(/%+$/, "")}%
              </div>
              <div className="text-xs text-tertiary">{t.side.kd} {a.kd}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
