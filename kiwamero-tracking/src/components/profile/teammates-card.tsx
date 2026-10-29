import Link from "next/link";
import type { Teammate } from "@/lib/types";

/** tracker.gg TEAMMATES card — `.acquaintances.v3-card` verbatim structure. */
export function TeammatesCard({ teammates, basePath }: { teammates: Teammate[]; basePath: string }) {
  if (!teammates.length) return null;
  return (
    <div className="acquaintances v3-card">
      <header className="v3-card__header">
        <div className="v3-card__title">Teammates</div>
        <div className="v3-card__description">Matches played together.</div>
      </header>
      <div className="relative">
        <div className="v3-card__body v3-card__body--v2.5">
          <div className="acquaintances__list overflow-hidden">
            {teammates.map((tm) => (
              <div className="acquaintances__list-player" key={`${tm.name}#${tm.tag}`}>
                <div className="header">
                  <div className="name" title={`${tm.name}#${tm.tag}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" xmlSpace="preserve" version="1.0" viewBox="0 0 150 150" className="platform-icon platform-riot icon">
                      <path d="M80.115 8.324 0 45.356l19.96 75.96 15.265-1.897-4.245-47.69 5.058-2.258 8.58 48.774 25.923-3.162-4.607-52.657 4.878-2.167 9.483 53.65 26.284-3.251-5.058-57.715 4.967-2.168 10.387 58.618 25.922-3.161V24.04z" />
                      <path d="m82.011 123.393 1.265 7.497 59.521 9.935v-24.838l-60.695 7.406z" />
                    </svg>
                    <Link href={`/valorant/profile/riot/${encodeURIComponent(`${tm.name}#${tm.tag}`)}`}>
                      {tm.name} <span className="discrim">#{tm.tag}</span>
                    </Link>
                  </div>
                  <div className="matches">{tm.matches} Matches</div>
                </div>
                <div className="stats">
                  <div className="stat">
                    <div className="label">K/D</div>
                    <div className="value">{tm.kd.toFixed(2)}</div>
                  </div>
                  <div className="stat">
                    <div className="label">Avg. Place</div>
                    <div className="value">{tm.avgPlace.toFixed(1)}</div>
                  </div>
                  <div className="stat stat--right">
                    <div className="label">Win Ratio</div>
                    <div className={`value${tm.winRate >= 65 ? " value--high" : tm.winRate >= 50 ? " value--positive" : " value--negative"}`}>
                      {tm.winRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="v3-card__action v3-card__action--v2.5">
        <Link href={`${basePath}/encounters`} className="trn-button trn-button--block w-full">View Details</Link>
      </div>
    </div>
  );
}
