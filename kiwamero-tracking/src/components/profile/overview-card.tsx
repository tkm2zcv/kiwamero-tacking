import Image from "next/image";
import Link from "next/link";
import type { Match, Profile } from "@/lib/types";
import { tierIcon } from "@/lib/henrikdev";
import { deriveOverview, playtimeLabel, type OverviewStats } from "@/lib/profile-stats";

function Donut({ wins, losses }: { wins: number; losses: number }) {
  const total = Math.max(wins + losses, 1);
  const r = 36;
  const c = 2 * Math.PI * r;
  const winArc = (wins / total) * c;
  return (
    <div className="kt-donut" aria-label={`${wins} wins, ${losses} losses`}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#d74654" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#0d9c82"
          strokeWidth="6"
          strokeDasharray={`${winArc} ${c - winArc}`}
          strokeLinecap="butt"
        />
      </svg>
      <div className="kt-donut-center">
        <span className="kt-w">{wins}</span>
        <span className="kt-l">W</span>
        <span className="kt-w">{losses}</span>
        <span className="kt-l">L</span>
      </div>
    </div>
  );
}

function RankChart({ matches, puuid, icon }: { matches: Match[]; puuid: string; icon: string }) {
  const values = matches
    .slice()
    .reverse()
    .map((m) => {
      const me = m.players.find((p) => p.puuid === puuid);
      if (!me) return 0;
      return me.stats.score / Math.max(1, m.metadata.rounds_played);
    })
    .filter((v) => v > 0)
    .slice(-20);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const w = 600;
  const h = 96;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 14 - ((v - min) / span) * (h - 34);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `M${pts[0][0]},${h} L${line.replace(/ /g, " L")} L${pts[pts.length - 1][0]},${h} Z`;
  const marks = [0, Math.floor(pts.length / 2), pts.length - 1];
  return (
    <div className="kt-rank-chart" aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <path d={area} fill="rgba(255,255,255,0.10)" stroke="none" />
        <polyline points={line} fill="none" stroke="#cfd6da" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      {marks.map((i) => (
        <Image
          key={i}
          src={icon}
          alt=""
          width={30}
          height={30}
          style={{
            left: `${(pts[i][0] / w) * 100}%`,
            top: `${(pts[i][1] / h) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

function Tile({ label, value, sub, gold }: { label: string; value: string; sub: string; gold?: boolean }) {
  return (
    <div className="kt-tile">
      <span className="kt-bar">
        <i />
      </span>
      <div className="kt-tile-body">
        <span className="kt-tile-name">{label}</span>
        <span className="kt-tile-value">{value}</span>
        <span className={gold ? "kt-tile-rank kt-tile-rank--gold" : "kt-tile-rank"}>{sub}</span>
      </div>
      <span className="kt-tile-more" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="kt-main-stat">
      <span className="kt-bar">
        <i />
      </span>
      <div className="kt-main-stat-body">
        <span className="kt-tile-name">{label}</span>
        <span className="kt-tile-value">{value}</span>
        <span className="kt-tile-rank">{sub}</span>
      </div>
    </div>
  );
}

export function OverviewCard({
  profile,
  matches,
  actLabel,
  playlist,
  basePath,
}: {
  profile: Profile;
  matches: Match[];
  actLabel: string;
  playlist: string;
  basePath: string;
}) {
  const s: OverviewStats = deriveOverview(matches, profile.puuid);
  const sample = `${s.matches} matches`;
  const donutWins = profile.seasonWins ?? s.wins;
  const donutLosses = profile.seasonGames != null && profile.seasonWins != null
    ? Math.max(0, profile.seasonGames - profile.seasonWins)
    : s.losses;

  return (
    <section className="kt-card" aria-label="Competitive overview">
      <header className="kt-card-head">
        <h2 className="kt-card-title">
          {actLabel} {playlist === "all" ? "All Modes" : playlist} Overview
        </h2>
        <div className="kt-card-desc">
          <span>{playtimeLabel(matches)}</span>
          <span className="kt-sep">{profile.seasonGames ?? s.matches} Matches</span>
        </div>
          <Link href={`${basePath}/performance`} className="kt-card-action">
            Show More
          </Link>
      </header>

      <div className="kt-card-body">
        <div className="kt-highlight">
          <div className="kt-highlight-bg">{profile.currentRank}</div>
          <div className="kt-highlight-content">
            <div className="kt-highlight-stats">
              <Image
                src={tierIcon(profile.currentTier || 0)}
                alt=""
                width={64}
                height={64}
                className="kt-highlight-icon"
              />
              <div className="kt-highlight-numbers">
                <div className="kt-stat">
                  <span className="kt-stat__label">{profile.currentRank}</span>
                  <span className="kt-stat__value">
                    {profile.currentTier ? profile.rr.toLocaleString("en-US") : "-"}
                    {profile.currentTier ? <sup>RR</sup> : null}
                  </span>
                  {profile.rankPosition ? <span className="kt-stat__sub">#{profile.rankPosition}</span> : null}
                </div>
                <div className="kt-stat">
                  <span className="kt-stat__label">Level</span>
                  <span className="kt-stat__value">{profile.level}</span>
                </div>
                <Donut wins={donutWins} losses={donutLosses} />
              </div>
            </div>
            <RankChart matches={matches} puuid={profile.puuid} icon={tierIcon(profile.currentTier || 0)} />
          </div>
        </div>

        <div className="kt-giant-stats">
          <Tile label="Damage/Round" value={s.adr.toFixed(1)} sub={sample} />
          <Tile label="K/D Ratio" value={s.kd.toFixed(2)} sub={sample} gold={s.kd >= 1.2} />
          <Tile label="Headshot %" value={`${s.hs.toFixed(1)}%`} sub={sample} />
          <Tile label="Win %" value={`${s.winRate.toFixed(1)}%`} sub={sample} />
        </div>

        <div className="kt-main-stats">
          <MiniStat label="Wins" value={String(s.wins)} sub={sample} />
          <MiniStat label="DDΔ/Round" value={s.ddPerRound.toFixed(0)} sub={sample} />
          <MiniStat label="Kills" value={s.kills.toLocaleString("en-US")} sub={sample} />
          <MiniStat label="Deaths" value={s.deaths.toLocaleString("en-US")} sub={sample} />
          <MiniStat label="Assists" value={s.assists.toLocaleString("en-US")} sub={sample} />
          <MiniStat label="ACS" value={s.acs.toFixed(1)} sub={sample} />
          <MiniStat label="KAD Ratio" value={s.kad.toFixed(2)} sub={sample} />
          <MiniStat label="Kills/Round" value={s.killsPerRound.toFixed(2)} sub={sample} />
        </div>
      </div>
    </section>
  );
}
