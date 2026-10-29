import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { EncounterStat } from "@/lib/stored-stats";
import { tierIcon } from "@/lib/henrikdev";

const COLS: { label: string; width: string; render: (e: EncounterStat) => React.ReactNode }[] = [
  { label: "Played With", width: "8rem", render: (e) => e.playedWith },
  {
    label: "Player Rank", width: "10rem", render: (e) => (
      <>
        <div className="image">
          <Image src={tierIcon(e.tier, "small")} alt={e.tierPatched || "Rank"} width={32} height={32} loading="lazy" unoptimized />
        </div>
        <div className="info">
          {e.tierPatched ? <div className="value">{e.tierPatched}</div> : null}
        </div>
      </>
    ),
  },
  { label: "Player Win Rate", width: "8rem", render: (e) => (e.playedWith ? `${e.winRate.toFixed(1)}%` : "—") },
  { label: "Player K/D", width: "8rem", render: (e) => (e.playedWith ? e.kd.toFixed(2) : "—") },
  { label: "Player Matches", width: "8rem", render: (e) => e.encounters },
  { label: "Last Encounter", width: "9rem", render: (e) => e.lastDay || "—" },
];

/** tracker.gg Encounters tab — players met in your matches, aggregated from match rosters. */
export function EncountersTable({ encounters, withOnly }: { encounters: EncounterStat[]; withOnly: boolean }) {
  const rows = withOnly ? encounters.filter((e) => e.playedWith > 0) : encounters;
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Player Encounters</h2>
      </header>
      <div className="v3-card__body v3-card__body--v2.5">
        {rows.length ? (
          <div className="st st--expand-hide-mobile st--scroll rounded-4 pb-4 st-valorant">
            <div className="st-header">
              <div className="st__item st-header__item st-header__item--sortable st__item--sticky st__item--wide" style={{ "--st-base-width": "12rem" } as CSSProperties}>
                <span className="label">Player</span>
              </div>
              {COLS.map((c, i) => (
                <div
                  key={c.label}
                  className={`st__item st-header__item st-header__item--sortable${i === 0 ? " st-header__item--active" : ""}`}
                  style={{ "--st-base-width": c.width } as CSSProperties}
                >
                  <span className="label">{c.label}</span>
                  {i === 0 ? (
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
                  ) : null}
                </div>
              ))}
              <div className="st__item st__item--expand st__item--expand-hide-mobile" />
            </div>
            <div className="st-content">
              <div className="st-content__category">
                {rows.map((e) => (
                  <div key={`${e.name}#${e.tag}`} className="st-content__item st-content__item--link">
                    <div className="st__item st-content__item-value st__item--sticky st__item--wide st-entry-player" style={{ "--st-base-width": "12rem" } as CSSProperties}>
                      <Link href={`/valorant/profile/riot/${encodeURIComponent(`${e.name}#${e.tag}`)}`}>
                        <div className="info">
                          <div className="value">{e.name}<span className="small"> #{e.tag}</span></div>
                        </div>
                      </Link>
                    </div>
                    {COLS.map((c) => (
                      <div
                        key={c.label}
                        className={`st__item st-content__item-value${c.label === "Player Rank" ? " st-entry-rank" : ""}`}
                        style={{ "--st-base-width": c.width } as CSSProperties}
                      >
                        {c.render(e)}
                      </div>
                    ))}
                    <div className="st__item st__item--expand st__item--expand-hide-mobile" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="kt-match-empty" style={{ padding: "1rem" }}>No encounters recorded for this filter.</p>
        )}
      </div>
    </div>
  );
}
