import Image from "next/image";
import type { CSSProperties } from "react";
import { agentColor, agentColor25, type AgentStat } from "@/lib/stored-stats";

interface Col {
  label: string;
  width: string;
  hidden?: boolean;
  render: (a: AgentStat) => React.ReactNode;
  highlight?: (a: AgentStat) => boolean;
}

const SORTED = "Matches";

/** tracker.gg Agents tab — verbatim `.st` component structure and column widths. */
export function AgentsTable({ agents }: { agents: AgentStat[] }) {
  const best = {
    kd: Math.max(...agents.map((a) => a.stats.kd), 0),
    adr: Math.max(...agents.map((a) => a.stats.adr), 0),
    acs: Math.max(...agents.map((a) => a.stats.acs), 0),
    hs: Math.max(...agents.map((a) => a.stats.hs), 0),
  };
  const na = "-";
  const cols: Col[] = [
    { label: "Time Played", width: "8.5rem", render: () => na },
    { label: "Matches", width: "6.5rem", render: (a) => a.stats.matches },
    { label: "Win %", width: "8rem", render: (a) => `${a.stats.winRate.toFixed(1)}%` },
    { label: "K/D", width: "6rem", render: (a) => a.stats.kd.toFixed(2), highlight: (a) => a.stats.kd === best.kd && best.kd > 0 },
    { label: "ADR", width: "7rem", render: (a) => a.stats.adr.toFixed(1), highlight: (a) => a.stats.adr === best.adr && best.adr > 0 },
    { label: "ACS", width: "7rem", render: (a) => a.stats.acs.toFixed(1), highlight: (a) => a.stats.acs === best.acs && best.acs > 0 },
    { label: "DDΔ", width: "5.5rem", render: (a) => <span className={a.stats.dd >= 0 ? "value--positive" : "value--negative"}>{a.stats.dd >= 0 ? "+" : ""}{Math.round(a.stats.dd)}</span> },
    { label: "HS%", width: "7rem", render: (a) => `${a.stats.hs.toFixed(1)}%`, highlight: (a) => a.stats.hs === best.hs && best.hs > 0 },
    { label: "KAST", width: "7rem", render: () => na },
    { label: "Kills", width: "7.5rem", hidden: true, render: (a) => a.stats.kills.toLocaleString(), highlight: () => true },
    { label: "Deaths", width: "7.5rem", hidden: true, render: (a) => a.stats.deaths.toLocaleString(), highlight: () => true },
    { label: "Assists", width: "6.5rem", hidden: true, render: (a) => a.stats.assists.toLocaleString(), highlight: () => true },
    { label: "Attack W/L", width: "10.5rem", hidden: true, render: () => na },
    { label: "Attack Win %", width: "8.5rem", hidden: true, render: () => na },
    { label: "Attack K/D", width: "7.75rem", hidden: true, render: () => na },
    { label: "Defense W/L", width: "10.5rem", hidden: true, render: () => na },
    { label: "Defense Win %", width: "9rem", hidden: true, render: () => na },
    { label: "Defense K/D", width: "8.25rem", hidden: true, render: () => na },
  ];
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Agents</h2>
      </header>
      <div className="v3-card__body v3-card__body--v2.5">
        {agents.length ? (
          <div className="st st--expand-hide-mobile st--scroll rounded-4 pb-4 st-valorant">
            <div className="st-header">
              <div className="st__item st-header__item st-header__item--sortable st__item--sticky st__item--wide agent-row" style={{ "--st-base-width": "9.5rem" } as CSSProperties}>
                <span className="label">Agent</span>
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
                {agents.map((a) => {
                  const color = agentColor(a.agent);
                  return (
                    <div key={a.agent} className="st-content__item st-content__item--link">
                      <div
                        className="st__item st-content__item-value st__item--sticky st__item--wide agent-row st-entry-agent"
                        style={{ "--st-base-width": "9.5rem", "--agent-color": color, "--agent-color-opacity-25": agentColor25(a.agent) } as CSSProperties}
                      >
                        <div className="image">
                          <Image src={a.icon} alt={a.agent} width={40} height={40} loading="lazy" className="size-full object-cover" />
                        </div>
                        <div className="info">
                          <div className="value">{a.agent}</div>
                          <div className="label">{a.role}</div>
                        </div>
                      </div>
                      {cols.map((c) => (
                        <div
                          key={c.label}
                          className={`st__item st-content__item-value${c.label === SORTED ? " st-content__item-value--active" : ""}${c.hidden ? " hidden-desktop" : ""}${c.highlight?.(a) ? " st-content__item-value--highlight" : ""}`}
                          style={{ "--st-base-width": c.width } as CSSProperties}
                        >
                          <div className="info">
                            <div className="value">{c.render(a)}</div>
                          </div>
                        </div>
                      ))}
                      <div className="st__item st__item--expand st-content__item-expand st__item--expand-hide-mobile">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 16" className="icon" aria-hidden="true"><path d="M2 12a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2" /></svg>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <p className="kt-match-empty" style={{ padding: "1rem" }}>No agent data for this filter.</p>
        )}
      </div>
    </div>
  );
}
