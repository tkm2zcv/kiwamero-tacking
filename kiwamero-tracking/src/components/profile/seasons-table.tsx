import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import type { Match, SeasonRank } from "@/lib/types";
import { modeLabel } from "@/lib/utils";
import { mapImage } from "@/lib/data";

export async function SeasonsTable({
  seasons,
  kind,
  matches,
  puuid,
}: {
  seasons: SeasonRank[];
  kind: "performance" | "agents" | "maps";
  matches: Match[];
  puuid: string;
}) {
  const t = await getDict();

  if (kind === "agents") {
    const agg = aggregate(matches, puuid, (m, me) => me.character);
    return <AggTable title={t.tabs.agents} rows={agg} imgFn={(k) => `/agents/${k.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o")}.webp`} t={t} />;
  }
  if (kind === "maps") {
    const agg = aggregate(matches, puuid, (m) => m.metadata.map);
    return <AggTable title={t.tabs.maps} rows={agg} imgFn={(k) => mapImage(k)} t={t} />;
  }

  // performance → season rank history
  return (
    <div className="trn-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-tertiary" style={{ background: "rgba(0,0,0,.3)" }}>
            <th className="px-4 py-2">Season</th>
            <th className="px-4 py-2">{t.stats.peak}</th>
            <th className="px-4 py-2 text-center">{t.stats.winRate}</th>
            <th className="px-4 py-2 text-center">{t.stats.kdRatio}</th>
            <th className="px-4 py-2 text-center">{t.stats.headshot}</th>
            <th className="px-4 py-2 text-center">{t.stats.matches}</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => (
            <tr key={s.actCode + s.act} className="border-t" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <td className="px-4 py-2.5">
                <div className="font-semibold">{s.act}</div>
                <div className="text-xs text-tertiary">{s.episode}</div>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Image src={s.rankIcon} alt={s.peakRank} width={30} height={30} />
                  <span className="font-semibold">{s.peakRank}</span>
                </div>
              </td>
              <td className="px-4 py-2.5 text-center" style={{ color: "var(--color-valorant-team-1)" }}>{s.winRate ?? "—"}</td>
              <td className="px-4 py-2.5 text-center">{s.kd ?? "—"}</td>
              <td className="px-4 py-2.5 text-center">{s.hs ?? "—"}</td>
              <td className="px-4 py-2.5 text-center">{s.games ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function aggregate(matches: Match[], puuid: string, key: (m: Match, me: Match["players"][0]) => string) {
  const acc = new Map<string, { n: number; w: number; k: number; d: number; score: number; rounds: number }>();
  for (const m of matches) {
    const me = m.players.find((p) => p.puuid === puuid);
    if (!me) continue;
    const k = key(m, me);
    const a = acc.get(k) ?? { n: 0, w: 0, k: 0, d: 0, score: 0, rounds: 0 };
    a.n++;
    const teamId = me.team_id?.toLowerCase();
    const team = teamId === "red" || teamId === "blue" ? m.teams[teamId] : undefined;
    if (team?.has_won) a.w++;
    a.k += me.stats.kills; a.d += me.stats.deaths; a.score += me.stats.score;
    a.rounds += m.metadata.rounds_played || 1;
    acc.set(k, a);
  }
  return [...acc.entries()]
    .sort((x, y) => y[1].n - x[1].n)
    .map(([key, s]) => ({ key, ...s, wr: (s.w / s.n) * 100, kd: s.d ? s.k / s.d : s.k, acs: Math.round(s.score / s.rounds) }));
}

function AggTable({
  title, rows, imgFn, t,
}: {
  title: string;
  rows: { key: string; n: number; wr: number; kd: number; acs: number }[];
  imgFn: (k: string) => string;
  t: { stats: { winRate: string; kdRatio: string; acs: string; matches: string } };
}) {
  return (
    <div className="trn-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-tertiary" style={{ background: "rgba(0,0,0,.3)" }}>
            <th className="px-4 py-2">{title}</th>
            <th className="px-4 py-2 text-center">{t.stats.matches}</th>
            <th className="px-4 py-2 text-center">{t.stats.winRate}</th>
            <th className="px-4 py-2 text-center">{t.stats.kdRatio}</th>
            <th className="px-4 py-2 text-center">{t.stats.acs}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <Image src={imgFn(r.key)} alt={r.key} width={30} height={30} className="rounded" />
                  <span className="font-semibold capitalize">{r.key}</span>
                </div>
              </td>
              <td className="px-4 py-2 text-center">{r.n}</td>
              <td className="px-4 py-2 text-center" style={{ color: "var(--color-valorant-team-1)" }}>{r.wr.toFixed(1)}%</td>
              <td className="px-4 py-2 text-center">{r.kd.toFixed(2)}</td>
              <td className="px-4 py-2 text-center">{r.acs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { modeLabel };
