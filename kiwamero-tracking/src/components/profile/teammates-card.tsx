import type { Teammate } from "@/lib/types";
import { tierIcon } from "@/lib/henrikdev";
import Image from "next/image";
import Link from "next/link";

/** tracker.gg matches-tab TEAMMATES card (`.acquaintances__list-player` rows). */
export function TeammatesCard({ teammates }: { teammates: Teammate[] }) {
  if (!teammates.length) return null;
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Teammates</h2>
        <p className="v3-card__description">Matches played together.</p>
      </header>
      <div className="v3-card__body kt-teammates">
        {teammates.map((tm) => (
          <div className="acquaintances__list-player" key={`${tm.name}#${tm.tag}`}>
            <div className="kt-tmate-head">
              <Image src={tierIcon(tm.tier, "small")} alt="" width={20} height={20} unoptimized />
              <Link href={`/valorant/profile/riot/${encodeURIComponent(`${tm.name}#${tm.tag}`)}`} className="kt-tmate-name">
                {tm.name}
              </Link>
              <span className="kt-muted">#{tm.tag}</span>
              <span className="kt-tmate-matches">{tm.matches} Matches</span>
            </div>
            <div className="stats">
              <span className="stat"><span className="label">K/D</span><span className="value">{tm.kd.toFixed(2)}</span></span>
              <span className="stat stat--right"><span className="label">Win Ratio</span><span className={`value${tm.winRate >= 50 ? " value--positive" : " value--negative"}`}>{tm.winRate.toFixed(1)}%</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
