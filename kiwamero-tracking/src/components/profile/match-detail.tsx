import Image from "next/image";
import type { Match } from "@/lib/types";
import { tierIcon } from "@/lib/henrikdev";
import { fmtDuration } from "@/lib/utils";

export function MatchDetail({ match, puuid }: { match: Match; puuid: string }) {
  const red = match.players.filter((p) => p.team_id?.toLowerCase() === "red");
  const blue = match.players.filter((p) => p.team_id?.toLowerCase() === "blue");
  const redWon = match.teams.red?.has_won;

  return (
    <div className="mt-1 overflow-hidden rounded-lg" style={{ background: "var(--color-surface-2)" }}>
      <div className="border-b border-black/30 px-4 py-2 text-xs text-secondary">
        {fmtDuration(match.metadata.game_length ?? 0)} · {match.metadata.cluster} · {match.metadata.game_start_patched}
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <TeamTable title="Red Team" players={red} won={!!redWon} score={match.teams.red?.rounds_won} me={puuid} rounds={match.metadata.rounds_played} />
        <TeamTable title="Blue Team" players={blue} won={redWon === false} score={match.teams.blue?.rounds_won} me={puuid} rounds={match.metadata.rounds_played} />
      </div>
    </div>
  );
}

function TeamTable({
  title, players, won, score, me, rounds,
}: {
  title: string;
  players: Match["players"];
  won: boolean;
  score?: number;
  me: string;
  rounds: number;
}) {
  const sorted = [...players].sort((a, b) => b.stats.score - a.stats.score);
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: won ? "var(--color-valorant-team-1)" : "var(--color-valorant-team-2)" }}>
          {title} · {score ?? ""}
        </span>
        <span className="text-[10px] font-bold uppercase" style={{ color: won ? "var(--color-valorant-team-1)" : "var(--color-valorant-team-2)" }}>
          {won ? "Victory" : "Defeat"}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase text-tertiary">
            <th className="px-1 py-1 font-medium">Player</th>
            <th className="px-1 py-1 text-center font-medium">Rank</th>
            <th className="px-1 py-1 text-center font-medium">ACS</th>
            <th className="px-1 py-1 text-center font-medium">K</th>
            <th className="px-1 py-1 text-center font-medium">D</th>
            <th className="px-1 py-1 text-center font-medium">A</th>
            <th className="px-1 py-1 text-center font-medium">+/-</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const diff = p.stats.kills - p.stats.deaths;
            const isMe = p.puuid === me;
            return (
              <tr key={p.puuid} className={isMe ? "bg-white/5" : ""}>
                <td className="flex items-center gap-2 px-1 py-1.5">
                  <Image
                    src={`/agents/${p.character.toLowerCase().replace(/\s+/g, "-").replace("kay/o", "kay-o")}.webp`}
                    alt={p.character}
                    width={22}
                    height={22}
                    className="rounded"
                  />
                  <span className="max-w-28 truncate font-medium">{p.name}<span className="text-tertiary">#{p.tag}</span></span>
                </td>
                <td className="px-1 py-1 text-center">
                  {p.currenttier ? <Image src={tierIcon(p.currenttier, "small")} alt="" width={20} height={20} className="mx-auto" /> : "—"}
                </td>
                <td className="px-1 py-1 text-center font-bold">{Math.round(p.stats.score / Math.max(1, rounds))}</td>
                <td className="px-1 py-1 text-center">{p.stats.kills}</td>
                <td className="px-1 py-1 text-center">{p.stats.deaths}</td>
                <td className="px-1 py-1 text-center">{p.stats.assists}</td>
                <td className="px-1 py-1 text-center font-medium" style={{ color: diff >= 0 ? "var(--color-valorant-team-1)" : "var(--color-valorant-team-2)" }}>
                  {diff >= 0 ? "+" : ""}{diff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
