import Image from "next/image";
import type { StoredRow } from "@/lib/stored-stats";
import { agentIconUrl } from "@/lib/stored-stats";
import { formatAct, timeAgo } from "@/lib/profile-stats";

/** tracker.gg BEST MATCHES sidebar — real `.trn-mini-row` component structure. */
export function BestMatchesCard({ rows, now }: { rows: StoredRow[]; now: number }) {
  if (!rows.length) return null;
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Best Matches</h2>
      </header>
      <div className="v3-card__filters">
        <div className="v3-filters">
          <span className="relative inline-flex">
            <button type="button" className="v3-filter">
              Kills
              <svg viewBox="0 0 4 16" aria-hidden="true"><circle cx="2" cy="2" r="2" /><circle cx="2" cy="8" r="2" /><circle cx="2" cy="14" r="2" /></svg>
            </button>
          </span>
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
                <div className="trn-mini-row__block trn-mini-row__stat">
                  <div className="label">{timeAgo(r.startedAt, now)}</div>
                  <div className="value">
                    <span className="value--positive">{r.won}</span> : <span className="value--negative">{r.lost}</span>
                  </div>
                </div>
                <div className="trn-mini-row__block trn-mini-row__stat">
                  <div className="label">Kills</div>
                  <div className="value">{r.kills}</div>
                </div>
                <div className="trn-mini-row__block trn-mini-row__stat">
                  <div className="label">Act</div>
                  <div className="value">{formatAct(r.seasonShort)}</div>
                </div>
                <div className="trn-mini-row__expand">
                  <svg viewBox="0 0 4 16" aria-hidden="true"><circle cx="2" cy="2" r="2" /><circle cx="2" cy="8" r="2" /><circle cx="2" cy="14" r="2" /></svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
