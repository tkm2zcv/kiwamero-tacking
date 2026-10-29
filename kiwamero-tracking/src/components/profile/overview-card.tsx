import Image from "next/image";
import Link from "next/link";
import type { Match, Profile } from "@/lib/types";
import { tierIcon } from "@/lib/henrikdev";
import { deriveOverview, playtimeLabel, type OverviewStats } from "@/lib/profile-stats";
import type { StatAggregate } from "@/lib/stored-stats";

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

export function OverviewCard({
  profile,
  matches,
  actLabel,
  playlist,
  basePath,
  stats,
}: {
  profile: Profile;
  matches: Match[];
  actLabel: string;
  playlist: string;
  basePath: string;
  /** Act-scoped aggregate from stored match history (covers all acts, unlike `matches` which is recent-only). */
  stats?: StatAggregate;
}) {
  const recent: OverviewStats = deriveOverview(matches, profile.puuid);
  const s = stats ?? recent;
  const sample = `${s.matches} matches`;
  const donutWins = stats ? stats.wins : (profile.seasonWins ?? recent.wins);
  const donutLosses = stats
    ? stats.losses
    : profile.seasonGames != null && profile.seasonWins != null
      ? Math.max(0, profile.seasonGames - profile.seasonWins)
      : recent.losses;

  return (
    <section className="kt-card" aria-label="Competitive overview">
      <header className="kt-card-head">
        <h2 className="kt-card-title">
          {actLabel} {playlist === "all" ? "All Modes" : playlist} Overview
        </h2>
        <div className="kt-card-desc">
          {stats ? null : <span>{playtimeLabel(matches)}</span>}
          <span className="kt-sep">{stats ? stats.matches : (profile.seasonGames ?? s.matches)} Matches</span>
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
          </div>
        </div>

        <div className="kt-giant-stats">
          <Tile label="Damage/Round" value={s.adr.toFixed(1)} sub={sample} />
          <Tile label="K/D Ratio" value={s.kd.toFixed(2)} sub={sample} gold={s.kd >= 1.2} />
          <Tile label="Headshot %" value={`${s.hs.toFixed(1)}%`} sub={sample} />
          <Tile label="Win %" value={`${s.winRate.toFixed(1)}%`} sub={sample} />
        </div>
      </div>
    </section>
  );
}
