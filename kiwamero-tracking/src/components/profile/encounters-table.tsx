import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { EncounterStat } from "@/lib/stored-stats";
import { tierIcon, tierName } from "@/lib/henrik-shared";
import { ActMenu } from "./act-menu";

export type EncounterMode = "with" | "against";

const sortIcon = (
  <svg viewBox="0 0 24 24" className="h-4 rotate-90 hidden" aria-hidden="true">
    <path fill="currentColor" d="m12 4-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z" />
  </svg>
);

function StatCell({ left, children }: { left?: boolean; children: React.ReactNode }) {
  return (
    <td className="relative flex items-center px-4 bg-inherit">
      <div className={`stat-ver inline-flex items-center gap-x-2 w-full truncate val${left ? " v3-stat-left" : ""}`}>
        <div className="name-value flex gap-x-space flex-col truncate">
          <div className="flex max-w-full items-center gap-2">
            <span className="stat-value inline-flex gap-0.5 value truncate">
              <span className="truncate">{children}</span>
            </span>
          </div>
        </div>
      </div>
    </td>
  );
}

/** tracker.gg Encounters tab — players met in your matches, aggregated from match rosters. */
export function EncountersTable({
  encounters,
  mode,
  filterItems,
}: {
  encounters: EncounterStat[];
  mode: EncounterMode;
  filterItems: { label: string; href: string; active?: boolean }[];
}) {
  const rows = [...encounters]
    .filter((e) => (mode === "against" ? e.playedAgainst > 0 : e.playedWith > 0))
    .sort((a, b) =>
      mode === "against"
        ? b.playedAgainst - a.playedAgainst || b.encounters - a.encounters
        : b.playedWith - a.playedWith || b.encounters - a.encounters
    );

  const count = (e: EncounterStat) => (mode === "against" ? e.playedAgainst : e.playedWith);
  const winRate = (e: EncounterStat) =>
    mode === "against"
      ? (e.playedAgainst ? (e.winsAgainst / e.playedAgainst) * 100 : 0)
      : e.winRate;
  const kd = (e: EncounterStat) =>
    mode === "against"
      ? (e.deathsAgainst ? e.killsAgainst / e.deathsAgainst : e.killsAgainst)
      : e.kd;

  const cols = [
    mode === "against" ? "Played Against" : "Played With",
    "Player Rank",
    "Player Win Rate",
    "Player K/D",
    "Player Matches",
    "Last Encounter",
  ];

  return (
    <div className="v3-card">
      <header className="v3-card__header">
        <h2 className="v3-card__title">Player Encounters</h2>
      </header>
      <div className="v3-card__filters">
        <div className="filters -mb-6 -ml-4 flex select-none items-center gap-4 overflow-auto pb-6 pl-4 font-medium no-scrollbar tl:overflow-hidden">
          <ActMenu
            variant="filter"
            label={mode === "against" ? "Played Against" : "Played With"}
            items={filterItems}
          />
        </div>
      </div>
      <div className="v3-card__body v3-card__body--v2.5">
        {rows.length ? (
          <div
            className="group/provider grid auto-cols-fr overflow-x-auto v3-stat-image-10 rounded-4"
            data-scroll-axes="x"
            style={{ gridTemplateColumns: "repeat(7, minmax(max-content, auto))" } as CSSProperties}
          >
            <table className="relative col-span-full grid grid-cols-subgrid gap-y-px">
              <thead className="col-span-full grid grid-cols-subgrid font-medium text-secondary sticky top-0 z-10 bg-surface-3">
                <tr className="group/header col-span-full grid grid-cols-subgrid min-h-8 bg-inherit">
                  <th className="flex select-none items-center px-4 bg-inherit sticky left-0 z-5 cursor-pointer">
                    <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate v3-stat-left">
                      <div className="name-value flex gap-x-space flex-col truncate">
                        <span className="stat-name inline-flex max-w-full overflow-hidden items-center gap-1">
                          {sortIcon}
                          <span className="truncate">Player</span>
                        </span>
                      </div>
                    </div>
                  </th>
                  {cols.map((c, i) => (
                    <th key={c} className="flex select-none items-center px-4 bg-inherit cursor-pointer">
                      <div className={`stat-ver inline-flex items-center gap-x-2 w-full truncate${i <= 1 ? " v3-stat-left" : ""}`}>
                        <div className="name-value flex gap-x-space flex-col truncate">
                          <span className="stat-name inline-flex max-w-full overflow-hidden items-center gap-1">
                            {sortIcon}
                            <span className="truncate">{c}</span>
                          </span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="col-span-full grid grid-cols-subgrid gap-[inherit]">
                {rows.map((e) => (
                  <tr
                    key={`${e.name}#${e.tag}`}
                    className="row group/row relative col-span-full grid grid-cols-subgrid min-h-14 bg-[--row-color]"
                    data-key={`${e.name}#${e.tag}`}
                  >
                    <td className="relative flex items-center px-4 bg-inherit sticky left-0 z-5">
                      <Link href={`/valorant/profile/riot/${encodeURIComponent(`${e.name}#${e.tag}`)}`} className="font-bold">
                        <span className="v3-trnign inline-flex items-center gap-1 text-16 font-medium leading-5/4 text-current no-underline">
                          <span className="max-w-full truncate">{e.name}</span>
                          <span className="v3-trnign__discriminator v3-chip v3-chip--sm shrink-0"> #{e.tag}</span>
                        </span>
                      </Link>
                    </td>
                    <StatCell>{count(e)}</StatCell>
                    <td className="relative flex items-center px-4 bg-inherit">
                      <div className="stat-ver inline-flex items-center gap-x-2 w-full truncate val v3-stat-left">
                        {e.tier ? (
                          <Image
                            className="image rounded-2 object-contain"
                            src={tierIcon(e.tier, "small")}
                            alt="Player Rank"
                            width={120}
                            height={120}
                            loading="lazy"
                            unoptimized
                          />
                        ) : null}
                        <div className="name-value flex gap-x-space flex-col truncate">
                          <div className="flex max-w-full items-center gap-2">
                            <span className="stat-value inline-flex gap-0.5 value truncate">
                              <span className="truncate">{e.tierPatched || tierName(e.tier) || "—"}</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <StatCell>{`${winRate(e).toFixed(1)}%`}</StatCell>
                    <StatCell>{kd(e).toFixed(2)}</StatCell>
                    <StatCell>{e.encounters}</StatCell>
                    <StatCell>{e.lastDay || "—"}</StatCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="kt-match-empty" style={{ padding: "1rem" }}>No encounters recorded for this filter.</p>
        )}
      </div>
    </div>
  );
}
