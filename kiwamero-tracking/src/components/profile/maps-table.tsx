import Image from "next/image";
import type { CSSProperties } from "react";
import { agentColor25, type MapStat } from "@/lib/stored-stats";

function mapSplash(mapId: string) {
  return `https://media.valorant-api.com/maps/${mapId}/splash.png`;
}

interface Col {
  label: string;
  width: string;
  hidden?: boolean;
  render: (m: MapStat) => React.ReactNode;
  highlight?: (m: MapStat) => boolean;
}

const SORTED = "Win %";

/** tracker.gg Maps tab — verbatim `.st` structure; splash via the ref's own --background-image-url. */
export function MapsTable({ maps }: { maps: MapStat[] }) {
  const best = {
    kd: Math.max(...maps.map((m) => m.stats.kd), 0),
    adr: Math.max(...maps.map((m) => m.stats.adr), 0),
    acs: Math.max(...maps.map((m) => m.stats.acs), 0),
    hs: Math.max(...maps.map((m) => m.stats.hs), 0),
  };
  const cols: Col[] = [
    { label: "Win %", width: "7rem", render: (m) => `${m.stats.winRate.toFixed(1)}%`, highlight: (m) => m.stats.winRate === Math.max(...maps.map((x) => x.stats.winRate)) && m.stats.winRate > 0 },
    { label: "Wins", width: "5.5rem", render: (m) => m.stats.wins, highlight: (m) => m.stats.wins === Math.max(...maps.map((x) => x.stats.wins)) && m.stats.wins > 0 },
    { label: "Losses", width: "6rem", render: (m) => m.stats.losses, highlight: (m) => m.stats.losses === Math.max(...maps.map((x) => x.stats.losses)) && m.stats.losses > 0 },
    { label: "K/D", width: "6rem", render: (m) => m.stats.kd.toFixed(2), highlight: (m) => m.stats.kd === best.kd && best.kd > 0 },
    { label: "ADR", width: "7rem", render: (m) => m.stats.adr.toFixed(1), highlight: (m) => m.stats.adr === best.adr && best.adr > 0 },
    { label: "ACS", width: "7rem", render: (m) => m.stats.acs.toFixed(1), highlight: (m) => m.stats.acs === best.acs && best.acs > 0 },
    { label: "DDΔ", width: "5.5rem", render: (m) => <span className={m.stats.dd >= 0 ? "value--positive" : "value--negative"}>{m.stats.dd >= 0 ? "+" : ""}{Math.round(m.stats.dd)}</span> },
    { label: "HS%", width: "7rem", hidden: true, render: (m) => `${m.stats.hs.toFixed(1)}%`, highlight: (m) => m.stats.hs === best.hs && best.hs > 0 },
    { label: "Aces", width: "5.5rem", hidden: true, render: () => "-" },
    { label: "Clutches", width: "7rem", hidden: true, render: () => "-" },
    { label: "Thrifty", width: "6.5rem", hidden: true, render: () => "-" },
    { label: "Flawless", width: "7rem", hidden: true, render: () => "-" },
    { label: "Plants", width: "6rem", hidden: true, render: () => "-" },
    { label: "Defuses", width: "6.5rem", hidden: true, render: () => "-" },
  ];
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Maps</h2>
      </header>
      <div className="v3-card__body v3-card__body--v2.5">
        {maps.length ? (
          <div className="st st--expand-hide-mobile rounded-4 pb-4 st-valorant">
            <div className="st-header">
              <div className="st__item st-header__item st-header__item--sortable st__item--sticky st__item--wide" style={{ "--st-base-width": "8.5rem" } as CSSProperties}>
                <span className="label">Map Name</span>
              </div>
              <div className="st__item st-header__item" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                <span className="label">Top Agents</span>
              </div>
              {cols.map((c) => (
                <div
                  key={c.label}
                  className={`st__item st-header__item st-header__item--sortable${c.label === SORTED ? " st-header__item--active" : ""}${c.hidden ? " hidden-desktop" : ""}`}
                  style={{ "--st-base-width": c.width } as CSSProperties}
                >
                  <span className="label">{c.label}</span>
                  {c.label === SORTED ? (
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
                  ) : null}
                </div>
              ))}
              <div className="st__item st__item--expand st__item--expand-hide-mobile" />
            </div>
            <div className="st-content">
              <div className="st-content__category">
                {maps.map((m) => (
                  <div key={m.map} className="st-content__item st-content__item--link">
                    <div
                      className="st__item st-content__item-value st__item--sticky st__item--wide"
                      style={{ "--st-base-width": "8.5rem", "--background-image-url": m.mapId ? `url(${mapSplash(m.mapId)})` : undefined } as CSSProperties}
                    >
                      <div className="info">
                        <div className="value">{m.map}</div>
                      </div>
                    </div>
                    <div className="st__item st-content__item-value" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                      <div className="flex flex-row items-center gap-2">
                        {m.topAgents.map((a) => (
                          <div key={a.agent} className="rounded-md flex flex-col items-center gap-1 overflow-hidden">
                            <div className="rounded-md size-6" style={{ backgroundColor: agentColor25(a.agent) }}>
                              <Image src={a.icon} alt={a.agent} width={24} height={24} loading="lazy" />
                            </div>
                            <span className="text-10 text-secondary">{Math.round((a.stats.matches / m.stats.matches) * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {cols.map((c) => (
                      <div
                        key={c.label}
                        className={`st__item st-content__item-value${c.label === SORTED ? " st-content__item-value--active" : ""}${c.hidden ? " hidden-desktop" : ""}${c.highlight?.(m) ? " st-content__item-value--highlight" : ""}`}
                        style={{ "--st-base-width": c.width } as CSSProperties}
                      >
                        <div className="info">
                          <div className="value">{c.render(m)}</div>
                        </div>
                      </div>
                    ))}
                    <div className="st__item st__item--expand st-content__item-expand st__item--expand-hide-mobile">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 16" className="icon" aria-hidden="true"><path d="M2 12a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2" /></svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="kt-match-empty" style={{ padding: "1rem" }}>No map data for this filter.</p>
        )}
      </div>
    </div>
  );
}
