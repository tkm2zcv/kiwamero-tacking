import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import { tierIcon } from "@/lib/henrikdev";
import type { Teammate } from "@/lib/types";

export async function TeammatesCard({ mates }: { mates: Teammate[] }) {
  const t = await getDict();
  if (!mates.length) return null;
  return (
    <div className="trn-card p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-tertiary">{t.side.teammates}</h3>
      <div className="space-y-1">
        {mates.map((m) => (
          <div key={`${m.name}#${m.tag}`} className="flex items-center gap-3 rounded p-1.5 hover:bg-white/5">
            <Image
              src={`/agents/${m.agent.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o")}.webp`}
              alt={m.agent}
              width={32}
              height={32}
              className="rounded"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{m.name}<span className="text-tertiary">#{m.tag}</span></div>
              <div className="flex items-center gap-1 text-xs text-tertiary">
                {m.tier ? <Image src={tierIcon(m.tier, "small")} alt="" width={14} height={14} /> : null}
                <span>{m.rankName}</span>
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="font-bold">{m.matches} {t.side.matchesPlayed}</div>
              <div style={{ color: "var(--color-valorant-team-1)" }}>{m.winRate.toFixed(0)}% · K/D {m.kd.toFixed(2)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
