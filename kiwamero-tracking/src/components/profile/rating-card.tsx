import Image from "next/image";
import { CircleHelp } from "lucide-react";
import type { Profile } from "@/lib/types";
import { tierIcon } from "@/lib/henrik-shared";
import { formatAct } from "@/lib/profile-stats";

export function RatingCard({ profile }: { profile: Profile }) {
  return (
    <section className="kt-card" aria-label="Current rating">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Current Rating</h2>
        <span className="kt-card-help" title="Rating reported by Riot">
          <CircleHelp size={18} />
        </span>
      </header>

      <div className="kt-card-body">
        <div className="kt-rating-top">
          <div className="kt-rating-entry">
            <Image
              src={tierIcon(profile.currentTier || 0)}
              alt=""
              width={40}
              height={40}
              className="kt-rank-icon"
            />
            <div className="kt-rank-info">
              <div className="kt-rank-label">{profile.currentRank}</div>
              <div className="kt-rank-value">
                <span className="kt-mmr">
                  {profile.currentTier ? profile.rr.toLocaleString("en-US") : "—"}
                  {profile.currentTier ? <sup>RR</sup> : null}
                </span>
              </div>
              {profile.rankPosition ? <div className="kt-rank-sub">#{profile.rankPosition}</div> : null}
            </div>
          </div>
        </div>

        <div className="kt-rating-peak">
          <h3>Peak Rating</h3>
          <div className="kt-rating-entry" style={{ paddingBottom: 0 }}>
            <Image src={tierIcon(profile.currentTier || 0)} alt="" width={40} height={40} className="kt-rank-icon" />
            <div className="kt-rank-info">
              <div className="kt-rank-value">
                {profile.peakRank}
                {profile.peakRr ? (
                  <span className="kt-mmr">
                    {profile.peakRr.toLocaleString("en-US")}
                    <sup>RR</sup>
                  </span>
                ) : null}
              </div>
              {profile.peakAct ? <div className="kt-rank-sub">{formatAct(profile.peakAct)}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
