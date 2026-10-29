import Image from "next/image";
import type { CSSProperties } from "react";
import { agentColor25, type SeasonStat } from "@/lib/stored-stats";
import type { SeasonRank } from "@/lib/types";

const EPISODE_PALETTE = ["#648FFF", "#DC267F", "#FFB000", "#FE6100", "#785EF0", "#29A634"];

/** tracker.gg labels e11+ acts by year: e11a1-3 → "Season 2025", e11a4-6 → "Season 2026". */
function episodeInfo(short: string): { ep: number; cls: number; label: string; act: number } | null {
  const e = short.toLowerCase().match(/^e(\d+)a(\d+)$/);
  if (e) {
    const ep = Number(e[1]);
    const act = Number(e[2]);
    if (ep < 11) return { ep, cls: ep, label: `Episode ${ep}`, act };
    const yr = 25 + (ep - 11) * 2 + Math.floor((act - 1) / 3);
    return { ep: yr - 15, cls: yr, label: `Season 20${yr}`, act };
  }
  const v = short.toLowerCase().match(/^v(\d+)a(\d+)$/);
  if (v) {
    const yr = Number(v[1]);
    return { ep: yr - 15, cls: yr, label: `Season 20${yr}`, act: Number(v[2]) };
  }
  return null;
}

/** Act cell label — tracker.gg shows the "V26: A6" / "E9: A3" code. */
function actCodeLabel(short: string): string {
  const info = episodeInfo(short);
  if (!info) return short.toUpperCase() || "—";
  if (info.cls >= 20) return `V${info.cls}: A${info.act}`;
  return `E${info.cls}: A${info.act}`;
}

/** tracker.gg Performance tab — real `.performance` + `.st.st-vpp` structure. */
export function PerformanceTable({
  seasons,
  lifetime,
  ranks,
  actLabel: actFilterLabel,
  currentRr,
  currentActCode,
}: {
  seasons: SeasonStat[];
  lifetime: SeasonStat;
  ranks: SeasonRank[];
  actLabel: string;
  currentRr?: number;
  currentActCode?: string;
}) {
  const rankOf = (short: string) =>
    ranks.find((r) => r.actCode.toLowerCase() === short.toLowerCase());
  const best = {
    kd: Math.max(...seasons.map((s) => s.stats.kd), 0),
    winRate: Math.max(...seasons.map((s) => s.stats.winRate), 0),
    hs: Math.max(...seasons.map((s) => s.stats.hs), 0),
  };
  const cols = [
    { label: "Playtime", width: "6.5rem", render: () => "-" },
    { label: "Wins", width: "6rem", render: (s: SeasonStat) => s.stats.wins },
    { label: "Win %", width: "6rem", render: (s: SeasonStat) => `${s.stats.winRate.toFixed(1)}%`, hl: (s: SeasonStat) => s.stats.winRate === best.winRate && best.winRate > 0 },
    { label: "K/D", width: "6rem", render: (s: SeasonStat) => s.stats.kd.toFixed(2), hl: (s: SeasonStat) => s.stats.kd === best.kd && best.kd > 0 },
    { label: "HS%", width: "6rem", render: (s: SeasonStat) => `${s.stats.hs.toFixed(1)}%`, hl: (s: SeasonStat) => s.stats.hs === best.hs && best.hs > 0 },
  ];
  return (
    <div className="performance v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Performance</h2>
      </header>
      <div className="v3-card__filters">
        <div className="v3-filters">
          <span className="relative inline-flex">
            <button type="button" className="v3-filter">
              {actFilterLabel}
              <svg viewBox="0 0 4 16" aria-hidden="true"><circle cx="2" cy="2" r="2" /><circle cx="2" cy="8" r="2" /><circle cx="2" cy="14" r="2" /></svg>
            </button>
          </span>
        </div>
      </div>
      <div className="v3-card__body v3-card__body--v2.5">
        <div className="performance-content-wrapper rounded-4 pb-4">
          <div className="performance-content">
            <div className="performance-content__header">
              <span>Lifetime</span>
              <div className="stats">
                <div className="value">-</div>
                <div className="value">{lifetime.stats.matches.toLocaleString()}</div>
                <div className="value">{lifetime.stats.winRate.toFixed(1)}%</div>
                <div className="value">{lifetime.stats.kd.toFixed(2)}</div>
                <div className="value">{lifetime.stats.hs.toFixed(1)}%</div>
                <div className="value">
                  {lifetime.topAgent ? (
                    <div className="image" style={{ backgroundColor: agentColor25(lifetime.topAgent.agent) }}>
                      <Image src={lifetime.topAgent.icon} alt={lifetime.topAgent.agent} width={40} height={40} loading="lazy" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="performance-content__table">
              <div className="st st-vpp">
                <div className="st-header">
                  <div className="st__item st-header__item st-header__item--align-left st-header__item--sortable st__item--align-left st-entry-episode" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                    <span className="label">Episode</span>
                  </div>
                  <div className="st__item st-header__item st-header__item--active st-header__item--align-left st__item--align-left st__item--wide" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                    <span className="label">Act</span>
                    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z" /></svg>
                  </div>
                  <div className="st__item st-header__item st-header__item--align-left st-header__item--sortable st__item--align-left st-entry-rank" style={{ "--st-base-width": "10rem" } as CSSProperties}>
                    <span className="label">Peak Rating</span>
                  </div>
                  {cols.map((c) => (
                    <div key={c.label} className="st__item st-header__item st-header__item--sortable" style={{ "--st-base-width": c.width } as CSSProperties}>
                      <span className="label">{c.label}</span>
                    </div>
                  ))}
                  <div className="st__item st-header__item st-header__item--sortable st-entry-top-agent" style={{ "--st-base-width": "7rem" } as CSSProperties}>
                    <span className="label">Top Agent</span>
                  </div>
                </div>
                <div className="st-content">
                  <div className="st-content__category">
                    {seasons.map((s) => {
                      const info = episodeInfo(s.seasonShort);
                      const color = `${EPISODE_PALETTE[((info?.ep ?? 1) - 1 + 600) % 6]}4D`;
                      const rank = rankOf(s.seasonShort);
                      return (
                        <div
                          key={s.seasonId || s.seasonShort}
                          className={`st-content__item st-content__item--episode-${info?.cls ?? 0}`}
                          style={{ "--episode-color": color } as CSSProperties}
                        >
                          <div className="st__item st-content__item-value st__item--align-left st-entry-episode" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                            <div className="info"><div className="value">{info?.label ?? s.seasonShort.toUpperCase()}</div></div>
                          </div>
                          <div className="st__item st-content__item-value st-content__item-value--active st__item--align-left st__item--wide" style={{ "--st-base-width": "8rem" } as CSSProperties}>
                            <div className="info">
                              <div className="value">{actCodeLabel(s.seasonShort)}</div>
                            </div>
                          </div>
                          <div className="st__item st-content__item-value st__item--align-left st-entry-rank" style={{ "--st-base-width": "10rem" } as CSSProperties}>
                            {rank ? (
                              <>
                                <div className="image">
                                  <Image src={rank.rankIcon} alt={rank.peakRank} width={80} height={80} loading="lazy" className="size-full object-cover" />
                                </div>
                                <div className="info">
                                  <div className="value">{rank.peakRank}</div>
                                  {currentActCode && s.seasonShort.toLowerCase() === currentActCode.toLowerCase() && currentRr != null ? (
                                    <div className="small small--gold">{currentRr} RR</div>
                                  ) : null}
                                </div>
                              </>
                            ) : (
                              <div className="info"><div className="value">—</div></div>
                            )}
                          </div>
                          {cols.map((c) => (
                            <div
                              key={c.label}
                              className={`st__item st-content__item-value${c.hl?.(s) ? " st-content__item-value--highlight" : ""}`}
                              style={{ "--st-base-width": c.width } as CSSProperties}
                            >
                              <div className="info">
                                <div className="value">{c.render(s)}</div>
                              </div>
                            </div>
                          ))}
                          <div
                            className="st__item st-content__item-value st-entry-top-agent"
                            style={{ "--st-base-width": "7rem", "--agent-color": s.topAgent ? agentColor25(s.topAgent.agent) : undefined } as CSSProperties}
                          >
                            {s.topAgent ? (
                              <div className="image">
                                <Image src={s.topAgent.icon} alt={s.topAgent.agent} width={80} height={80} loading="lazy" className="size-full object-cover" />
                              </div>
                            ) : null}
                            <div className="info" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
