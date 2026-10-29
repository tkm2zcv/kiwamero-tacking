import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Match, TopAgent } from "@/lib/types";
import { mapImage } from "@/lib/data";

function agentExtras(matches: Match[], puuid: string) {
  const acc = new Map<string, { dmg: number; recv: number; rounds: number; secs: number; maps: Map<string, { n: number; w: number }> }>();
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const rounds = m.metadata.rounds_played || 1;
    const a = acc.get(me.character) ?? { dmg: 0, recv: 0, rounds: 0, secs: 0, maps: new Map() };
    a.dmg += me.damage_made ?? 0;
    a.recv += me.damage_received ?? 0;
    a.rounds += rounds;
    a.secs += m.metadata.game_length || 0;
    const map = a.maps.get(m.metadata.map) ?? { n: 0, w: 0 };
    map.n += 1;
    const tid = me.team_id?.toLowerCase();
    if ((tid === "red" || tid === "blue") && m.teams[tid]?.has_won) map.w += 1;
    a.maps.set(m.metadata.map, map);
    acc.set(me.character, a);
  }
  return (agent: string) => {
    const a = acc.get(agent);
    if (!a) return { adr: "—", dd: "—", hours: "0", bestMap: null as null | { map: string; wr: number } };
    const best = [...a.maps.entries()].sort((x, y) => y[1].w / y[1].n - x[1].w / x[1].n)[0];
    const h = a.secs / 3600;
    return {
      adr: a.dmg ? (a.dmg / Math.max(1, a.rounds)).toFixed(1) : "—",
      dd: a.dmg ? Math.round((a.dmg - a.recv) / Math.max(1, a.rounds)).toString() : "—",
      hours: h >= 10 ? String(Math.round(h)) : h.toFixed(1),
      bestMap: best ? { map: best[0], wr: (best[1].w / best[1].n) * 100 } : null,
    };
  };
}

function wrClass(wr: number) {
  if (wr >= 66) return "kt-wr kt-wr--super";
  if (wr >= 55) return "kt-wr kt-wr--good";
  return "kt-wr";
}

export function TopAgentsCard({
  agents,
  matches,
  puuid,
  actLabel,
  basePath,
}: {
  agents: TopAgent[];
  matches: Match[];
  puuid: string;
  actLabel: string;
  basePath: string;
}) {
  const extras = agentExtras(matches, puuid);
  const rows = agents.slice(0, 3);
  if (!rows.length) return null;

  return (
    <section className="kt-card" aria-label="Top agents">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Top Agents</h2>
        <p className="kt-card-desc">Based on total agent playtime during {actLabel}.</p>
        <Link href={`${basePath}/agents`} className="kt-card-action">
          All Agents <ChevronRight size={18} />
        </Link>
      </header>

      <div className="kt-card-body kt-table">
        <div className="kt-thead">
          <div>Agent</div>
          <div>Matches</div>
          <div>Win %</div>
          <div>K/D</div>
          <div>ADR</div>
          <div>ACS</div>
          <div>DDΔ</div>
          <div>Best Map</div>
        </div>
        {rows.map((a) => {
          const ex = extras(a.agent);
          return (
            <div className="kt-trow" key={a.agent}>
              <div className="kt-tcell-agent">
                <Image src={a.icon} alt="" width={40} height={40} />
                <div>
                  <div className="kt-name">{a.name}</div>
                  <div className="kt-sub">{ex.hours} hours</div>
                </div>
              </div>
              <div className="kt-tcell">{a.matches}</div>
              <div className="kt-tcell">{a.winRate}</div>
              <div className={Number(a.kd) >= 1.4 ? "kt-tcell kt-tcell--gold" : "kt-tcell"}>{a.kd}</div>
              <div className="kt-tcell">{ex.adr}</div>
              <div className="kt-tcell">{a.acs}</div>
              <div className="kt-tcell">{ex.dd}</div>
              <div className="kt-bestmap">
                {ex.bestMap ? (
                  <>
                    <span className="kt-mapname">{ex.bestMap.map}</span>
                    <span className={wrClass(ex.bestMap.wr)}>{ex.bestMap.wr.toFixed(0)}% WR</span>
                    <Image src={mapImage(ex.bestMap.map)} alt="" width={32} height={32} />
                  </>
                ) : (
                  <span className="kt-mapname">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
