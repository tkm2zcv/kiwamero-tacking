import type { PartyBreakdown } from "@/lib/types";

const LABELS = ["Solo", "Duo", "Trio", "4 Stack", "5 Stack"];

function PersonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor" aria-hidden="true">
      <circle cx="8" cy="4.5" r="2.75" />
      <path d="M2 14.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5v1.5H2v-1.5Z" />
    </svg>
  );
}

/** tracker.gg "Party Size Breakdown" — own stats grouped by premade size. */
export function PartyBreakdownCard({ breakdown }: { breakdown: PartyBreakdown[] }) {
  if (!breakdown.length) return null;
  return (
    <div className="acquaintances v3-card">
      <header className="v3-card__header">
        <div className="v3-card__title">Party Size Breakdown</div>
        <div className="v3-card__description">Recent match stats by premade size.</div>
      </header>
      <div className="relative">
        <div className="v3-card__body v3-card__body--v2.5">
          <div className="acquaintances__list overflow-hidden">
            {breakdown.map((b) => (
              <div className="acquaintances__list-player" key={b.size}>
                <div className="header">
                  <div className="name" title={LABELS[b.size - 1]}>
                    <span style={{ display: "inline-flex", gap: 2, marginRight: 6, color: "var(--color-text-secondary)", verticalAlign: -1 }}>
                      {Array.from({ length: b.size }, (_, i) => <PersonIcon key={i} />)}
                    </span>
                    {LABELS[b.size - 1]}
                  </div>
                  <div className="matches">{b.matches} Matches</div>
                </div>
                <div className="stats">
                  <div className="stat">
                    <div className="label">K/D</div>
                    <div className="value">{b.kd.toFixed(2)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Avg. Place</div>
                    <div className="value">{b.avgPlace.toFixed(1)}</div>
                  </div>
                  <div className="stat stat--right">
                    <div className="label">Win Ratio</div>
                    <div className={`value${b.winRate >= 65 ? " value--high" : b.winRate >= 50 ? " value--positive" : " value--negative"}`}>
                      {b.winRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
