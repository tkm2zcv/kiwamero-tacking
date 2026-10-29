import Image from "next/image";
import type { StoredRow } from "@/lib/stored-stats";
import { agentIconUrl } from "@/lib/stored-stats";
import { formatAct, timeAgo } from "@/lib/profile-stats";

const dots = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="text-current" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2"
    />
  </svg>
);

const expandDots = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 16" className="icon" aria-hidden="true">
    <path d="M2 12a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2m0-6a2 2 0 1 1-2 2 2 2 0 0 1 2-2" />
  </svg>
);

/** tracker.gg BEST MATCHES sidebar — real `.trn-mini-row` component structure. */
export function BestMatchesCard({ rows, now }: { rows: StoredRow[]; now: number }) {
  if (!rows.length) return null;
  return (
    <div className="best-matches v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Best Matches</h2>
      </header>
      <div className="v3-card__filters">
        <div className="filters -mb-6 -ml-4 flex select-none items-center gap-4 overflow-auto pb-6 pl-4 font-medium no-scrollbar tl:overflow-hidden">
          <div className="v3-filter">
            <span>Kills</span>
            {dots}
          </div>
        </div>
      </div>
      <div className="v3-card__body">
        <div className="best-matches__content">
          <div className="best-matches__content-matches">
            {rows.map((r) => (
              <div className="trn-mini-row" key={r.id}>
                <div className="trn-mini-row__icon">
                  <Image src={agentIconUrl(r.agent)} alt={r.agent} width={32} height={32} loading="lazy" />
                </div>
                <div className="trn-mini-row__block trn-mini-row__stat" style={{ width: "3.5rem" }}>
                  <div className="label truncate">{timeAgo(r.startedAt, now)}</div>
                  <div className="value truncate">
                    <span className="value--positive">{r.won}</span> : <span className="value--negative">{r.lost}</span>
                  </div>
                </div>
                <div className="trn-mini-row__block trn-mini-row__stat" style={{ width: "3rem" }}>
                  <div className="label truncate">Kills</div>
                  <div className="value truncate">{r.kills}</div>
                </div>
                <div className="trn-mini-row__block trn-mini-row__stat trn-mini-row__stat-act" style={{ width: "4rem" }}>
                  <div className="label truncate"> Act </div>
                  <div className="value truncate">{formatAct(r.seasonShort)}</div>
                </div>
                <div className="trn-mini-row__expand -mr-1 pl-2">{expandDots}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
