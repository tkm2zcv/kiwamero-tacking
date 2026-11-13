import Link from "next/link";
import { ActMenu, type ActMenuItem } from "@/components/profile/act-menu";
import { PLAYLISTS, profileFilterHref } from "@/lib/profile-filters";

const MODES = PLAYLISTS.slice(0, 5);
const EXTRA_MODES = PLAYLISTS.slice(5);

export interface FiltersAct {
  /** Canonical act code, e.g. "e11a6". */
  code: string;
  /** Season selector value used in the `season=` query param (uuid when known, else act code). */
  param: string;
  /** Display label, e.g. "V26: A6". */
  label: string;
}

export function FiltersBar({
  basePath,
  tab,
  playlist,
  act,
  acts,
  played,
}: {
  basePath: string;
  /** Current tab path segment — filters keep the user on the same tab (tracker.gg behavior). */
  tab: string;
  playlist: string;
  /** Current `season` param: "all" | "latest" | season uuid | act code. */
  act: string;
  /** Acts available on this profile, newest first (from the player's first act). */
  acts: FiltersAct[];
  played?: "with" | "against";
}) {
  const tabPath = tab === "overview" ? "overview" : tab;
  const url = (mode: string, season: string) =>
    profileFilterHref(basePath, tabPath, mode, season, played);

  // tracker.gg shows "All Acts" + one act button + a `⋯` overflow menu.
  // The second button is the selected act — or the latest act when "all"/"latest".
  const actLow = act.toLowerCase();
  const matchesAct = (a: FiltersAct) =>
    a.param.toLowerCase() === actLow || a.code === actLow;
  const secondAct =
    act === "all" || act === "latest"
      ? acts[0]
      : acts.find(matchesAct) ?? acts[0];
  const menuItems: ActMenuItem[] = acts
    .filter((a) => a !== secondAct)
    .map((a) => ({
      label: a.label,
      href: url(playlist, a.param),
      active: matchesAct(a),
    }));

  return (
    <div className="kt-filters" aria-label="Profile filters">
      <div className="kt-seg kt-seg--outline">
        <span className="kt-platform-label">PC</span>
      </div>

      <div className="kt-col-3">
        <div className="kt-seg">
          {tab === "encounters" ? (
            <Link href={url("all", act)} className="kt-seg-btn" data-active={playlist === "all"}>
              ALL
            </Link>
          ) : null}
          {MODES.map(({ slug, label }) => (
            <Link key={slug} href={url(slug, act)} className="kt-seg-btn" data-active={playlist === slug}>
              {label}
            </Link>
          ))}
          {tab !== "encounters" ? (
            <Link href={url("all", act)} className="kt-seg-btn" data-active={playlist === "all"}>
              All
            </Link>
          ) : null}
          <ActMenu
            menuLabel="More playlists"
            items={EXTRA_MODES.map(({ slug, label }) => ({
              label,
              href: url(slug, act),
              active: playlist === slug,
            }))}
          />
        </div>
      </div>

      <div className="kt-seg">
        <Link href={url(playlist, "all")} className="kt-seg-btn" data-active={act === "all"}>
          All Acts
        </Link>
        {secondAct ? (
          <Link
            href={url(playlist, secondAct.param)}
            className="kt-seg-btn"
            data-active={act === "latest" || matchesAct(secondAct)}
          >
            {secondAct.label}
          </Link>
        ) : null}
        <ActMenu items={menuItems} />
      </div>
    </div>
  );
}
