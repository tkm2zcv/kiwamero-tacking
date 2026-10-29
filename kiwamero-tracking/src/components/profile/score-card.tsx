import type { Profile } from "@/lib/types";
import { deriveOverview } from "@/lib/profile-stats";
import type { Match } from "@/lib/types";

type Tier = "S" | "A" | "B" | "C";

const TIER_COLOR: Record<Tier, string> = {
  S: "#3ecbff",
  A: "#5ee790",
  B: "#cbb765",
  C: "#99abbf",
};

/** Absolute thresholds — our own scale, not a percentile of the player base. */
function tierOf(score: number): Tier {
  if (score >= 80) return "S";
  if (score >= 62) return "A";
  if (score >= 45) return "B";
  return "C";
}

function metric(value: number, min: number, max: number) {
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return Math.round(ratio * 100);
}

function Emblem({ tier }: { tier: Tier }) {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden="true">
      <path
        d="M28 2 51 15v26L28 54 5 41V15z"
        fill="none"
        stroke={TIER_COLOR[tier]}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M28 16l10 18H18z" fill={TIER_COLOR[tier]} opacity="0.85" />
    </svg>
  );
}

export function ScoreCard({ profile, matches }: { profile: Profile; matches: Match[] }) {
  const s = deriveOverview(matches, profile.puuid);
  const stats = [
    { label: "Round Win %", raw: `${s.winRate.toFixed(1)}%`, score: metric(s.winRate, 30, 65) },
    { label: "K/D", raw: s.kd.toFixed(2), score: metric(s.kd, 0.6, 1.6) },
    { label: "ACS", raw: s.acs.toFixed(1), score: metric(s.acs, 120, 320) },
    { label: "DDΔ/Round", raw: s.ddPerRound.toFixed(0), score: metric(s.ddPerRound, -20, 60) },
  ];
  const overall = Math.round(
    (stats[0].score * 0.3 + stats[1].score * 0.2 + stats[2].score * 0.3 + stats[3].score * 0.2) * 10
  );
  const tier = tierOf(overall / 10);

  return (
    <div className="kt-score" aria-label="Kiwamero score">
      <div className="kt-score-grid">
        <div className="kt-score-left">
          <Emblem tier={tier} />
          <div>
            <div className="kt-score-label">Kiwamero Score</div>
            <div className="kt-score-value">
              {overall}
              <sup>/1000</sup>
            </div>
          </div>
        </div>
        <div className="kt-score-stats">
          {stats.map((stat) => {
            const t = tierOf(stat.score);
            return (
              <div className="kt-score-stat" key={stat.label}>
                <span className="kt-score-label">{stat.label}</span>
                <span className="kt-score-value">{stat.raw}</span>
                <span className="kt-percentile">
                  <span style={{ color: TIER_COLOR[t] }}>{t}</span> · {stat.score}/100
                </span>
                <span className="kt-score-bar" style={{ background: TIER_COLOR[t] }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
