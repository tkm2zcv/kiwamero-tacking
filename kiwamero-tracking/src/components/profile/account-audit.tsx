import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import { formatAct } from "@/lib/profile-stats";
import { tierIcon } from "@/lib/henrikdev";
import type { Profile, SeasonRank, Summary } from "@/lib/types";

/**
 * Account Audit (アカウント査定) — facts we can honestly derive from the account
 * and MMR payloads. No speculation: every row is backed by real data or shows "—".
 */
export async function AccountAudit({
  profile,
  seasons,
  summary,
  capturedAt,
}: {
  profile: Profile;
  seasons: SeasonRank[];
  summary: Summary;
  capturedAt: string;
}) {
  const t = await getDict();
  const actOrder = (code: string) => {
    const m = code.toLowerCase().match(/^e(\d+)a(\d+)$/);
    return m ? Number(m[1]) * 100 + Number(m[2]) : -1;
  };
  const firstAct = [...seasons].sort((a, b) => actOrder(a.actCode) - actOrder(b.actCode))[0];
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Account Level", value: profile.level || "—" },
    { label: "Region", value: profile.region?.toUpperCase() || "—" },
    { label: "Current Rating", value: profile.currentRank || "—" },
    { label: "Rank Rating", value: profile.rr != null ? `${profile.rr} RR` : "—" },
    { label: "Peak Rating", value: profile.peakRank ? `${profile.peakRank}${profile.peakAct ? ` (${formatAct(profile.peakAct)})` : ""}` : "—" },
    { label: "First Act Seen", value: firstAct ? formatAct(firstAct.actCode) : "—" },
    { label: "Lifetime Matches", value: summary.totalMatches || summary.matches || "—" },
    { label: "Lifetime Win Rate", value: summary.matches ? `${summary.winRate.toFixed(1)}%` : "—" },
    { label: "Lifetime K/D", value: summary.matches ? summary.kd.toFixed(2) : "—" },
    { label: "Last Updated", value: profile.lastUpdated || new Date(capturedAt).toLocaleDateString("en-US", { dateStyle: "medium" }) },
  ];
  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">{t.diagnosis.accountAudit}</h2>
      </header>
      <div className="v3-card__body v3-card__body--v2.5">
        <div className="grid gap-y-px rounded-4 overflow-hidden">
          <div className="row relative flex min-h-14 bg-[--row-color] items-center">
            <div className="relative flex items-center px-4 bg-inherit">
              <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate val v3-stat-left">
                {profile.currentTier ? (
                  <Image className="image rounded-2 object-contain" src={tierIcon(profile.currentTier, "small")} alt="" width={120} height={120} unoptimized />
                ) : null}
                <div className="name-value flex gap-x-space flex-col truncate">
                  <div className="flex max-w-full items-center gap-2">
                    <span className="stat-value inline-flex gap-0.5 value truncate">
                      <span className="truncate">{profile.currentRank || "—"}</span>
                    </span>
                  </div>
                  {profile.rankPosition ? (
                    <div className="substats flex text-10 leading-4/4 text-secondary v3-separate v3-separate-secondary mt-1">
                      <span className="text-gold">#{profile.rankPosition.toLocaleString("en-US")}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
          {rows.map((r) => (
            <div key={r.label} className="row relative flex min-h-14 bg-[--row-color] items-center">
              <div className="relative flex items-center px-4 bg-inherit">
                <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate val v3-stat-left">
                  <div className="name-value flex gap-x-space flex-col truncate">
                    <div className="flex max-w-full items-center gap-2">
                      <span className="stat-value inline-flex gap-0.5 value truncate">
                        <span className="truncate">{r.value}</span>
                      </span>
                    </div>
                    <div className="substats flex text-10 leading-4/4 text-secondary v3-separate v3-separate-secondary mt-1">
                      <span>{r.label}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
