import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/lib/types";
import {
  ROLE_META,
  deriveAccuracy,
  deriveMaps,
  deriveMatchRows,
  deriveRoles,
  type RoleStat,
} from "@/lib/profile-stats";

function wrColor(wr: number) {
  if (wr >= 60) return "var(--kt-good)";
  if (wr >= 50) return "var(--kt-text)";
  return "var(--kt-loss)";
}

export function AccuracyCard({ matches, puuid }: { matches: Match[]; puuid: string }) {
  const a = deriveAccuracy(matches, puuid);
  const rows = deriveMatchRows(matches, puuid).slice(0, 10).reverse();
  const bars = rows.map((r) => r.hs);

  return (
    <section className="kt-card" aria-label="Accuracy">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Accuracy</h2>
        <p className="kt-card-desc">Last {matches.length} Matches</p>
      </header>

      <div className="kt-card-body">
        <div className="kt-accuracy">
          <svg width="34" height="80" viewBox="0 0 34 80" fill="none" aria-hidden="true">
            <circle cx="17" cy="8" r="5" stroke="#99abbf" strokeWidth="2" />
            <path
              d="M17 14v30M17 18l-8 8M17 18l8 8M17 44l-6 22M17 44l6 22"
              stroke="#99abbf"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path d="M11 66h12" stroke="#5ee790" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 44h18" stroke="#99abbf" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <table className="kt-accuracy-body-table">
            <tbody>
              <tr>
                <th>Head</th>
                <td>
                  <span>{a.head.pct.toFixed(1)}%</span> <span className="kt-muted">{a.head.hits} Hits</span>
                </td>
              </tr>
              <tr>
                <th>Body</th>
                <td className="kt-hl">
                  <span>{a.body.pct.toFixed(1)}%</span> <span className="kt-muted">{a.body.hits} Hits</span>
                </td>
              </tr>
              <tr>
                <th>Legs</th>
                <td>
                  <span>{a.legs.pct.toFixed(1)}%</span> <span className="kt-muted">{a.legs.hits} Hits</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="kt-accuracy-sub">AVG HS%</div>
        <div className="kt-hits-chart">
          <svg viewBox={`0 0 ${Math.max(bars.length * 20, 100)} 100`} preserveAspectRatio="none" role="img" aria-label="Headshot percentage per match">
            {bars.map((v, i) => (
              <rect
                key={i}
                x={i * 20 + 5}
                y={100 - v * 1.6}
                width="8"
                height={Math.max(v * 1.6, 2)}
                fill="#5ee790"
                opacity="0.9"
                rx="1"
              />
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}

function RoleDonut({ stat }: { stat: RoleStat }) {
  const pct = Math.round(stat.winRate);
  return (
    <div
      className="kt-role-chart"
      style={{
        background: `conic-gradient(${wrColor(stat.winRate)} ${pct * 3.6}deg, rgba(255,255,255,0.12) 0deg)`,
      }}
    >
      <div className="kt-role-chart-inner">
        <Image src={ROLE_META[stat.role].icon} alt="" width={24} height={24} />
      </div>
    </div>
  );
}

export function RolesCard({ matches, puuid }: { matches: Match[]; puuid: string }) {
  const roles = deriveRoles(matches, puuid);
  if (!roles.length) return null;
  return (
    <section className="kt-card" aria-label="Roles">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Roles</h2>
      </header>
      <div className="kt-card-body">
        <div className="kt-roles">
          {roles.map((r) => (
            <div className="kt-role" key={r.role}>
              <RoleDonut stat={r} />
              <div>
                <h5 className="kt-role-name">{ROLE_META[r.role].label}</h5>
                <div className="kt-role-stats">
                  <div className="kt-role-stat">
                    <span className="kt-role-value" style={{ color: wrColor(r.winRate) }}>
                      WR {r.winRate.toFixed(1)}%
                    </span>
                    <span className="kt-role-sub">
                      <span>{r.wins}W</span>
                      <span>{r.losses}L</span>
                    </span>
                  </div>
                  <div className="kt-role-stat">
                    <span className="kt-role-value">KDA {r.kad.toFixed(2)}</span>
                    <span className="kt-role-sub">
                      <span>{r.kills}</span>
                      <span>{r.deaths}</span>
                      <span>{r.assists}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TopMapsCard({
  matches,
  puuid,
  basePath,
}: {
  matches: Match[];
  puuid: string;
  basePath: string;
}) {
  const maps = deriveMaps(matches, puuid).slice(0, 6);
  if (!maps.length) return null;
  return (
    <section className="kt-card" aria-label="Top maps">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Top Maps</h2>
      </header>
      <div className="kt-card-body">
        <div className="kt-maps">
          {maps.map((m) => (
            <div className="kt-maprow" key={m.map}>
              <span className="kt-maprow-name">{m.map}</span>
              <span className="kt-maprow-info">
                <span className="kt-maprow-pct">{m.winRate.toFixed(1)}%</span>
                <span className="kt-maprow-wl">
                  {m.wins}W - {m.losses}L
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="kt-card-foot">
        <Link href={`${basePath}/maps`} className="kt-btn kt-btn--secondary kt-btn--wide">
          View All Maps
        </Link>
      </div>
    </section>
  );
}
