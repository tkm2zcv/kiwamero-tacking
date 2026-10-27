import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { AGENT_ICON, TIER_ICON } from "@/lib/utils";

export interface Teammate {
  name: string;
  tag: string;
  agent: string;
  rankName: string;
  tier: number;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  kd: number;
}

export function TeammatesCard({ teammates }: { teammates: Teammate[] }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Users className="h-4 w-4 text-muted-foreground" />
          よく組むメンバー
        </h3>
        <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          すべて見る &rsaquo;
        </button>
      </div>
      <ul className="space-y-2">
        {teammates.map((t) => (
          <li key={`${t.name}#${t.tag}`}>
            <Link
              href={`/tracker/${encodeURIComponent(t.name)}/${encodeURIComponent(t.tag)}`}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 p-2.5 hover:border-border transition-colors"
            >
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60">
                <Image
                  src={AGENT_ICON(t.agent)}
                  alt={t.agent}
                  fill
                  className="object-cover scale-110"
                  sizes="40px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                  {t.name}
                  <span className="text-xs font-normal text-muted-foreground">#{t.tag}</span>
                  <Image
                    src={TIER_ICON(t.tier)}
                    alt={t.rankName}
                    width={16}
                    height={16}
                    className="h-4 w-4 object-contain"
                  />
                </p>
                <p className="text-xs text-muted-foreground">
                  {t.matches} 試合 ({t.wins}勝 {t.losses}敗)
                </p>
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <p className="text-[10px] text-muted-foreground">勝率</p>
                  <p className="text-sm font-bold text-emerald-400">{t.winRate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">K/D</p>
                  <p className="text-sm font-bold text-foreground/90">{t.kd.toFixed(2)}</p>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
