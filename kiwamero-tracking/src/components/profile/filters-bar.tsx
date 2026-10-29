import Link from "next/link";

const MODES = [
  ["competitive", "Competitive"],
  ["premier", "Premier"],
  ["unrated", "Unrated"],
  ["deathmatch", "Deathmatch"],
  ["swiftplay", "Swiftplay"],
] as const;

export function FiltersBar({
  basePath,
  playlist,
  act,
  actLabel,
}: {
  basePath: string;
  playlist: string;
  act: string;
  actLabel: string;
}) {
  const url = (mode: string, season: string) =>
    `${basePath}/overview?platform=pc&playlist=${mode}&season=${season}`;

  return (
    <div className="kt-filters" aria-label="Profile filters">
      <div className="kt-seg kt-seg--outline">
        <span className="kt-platform-label">PC</span>
      </div>

      <div className="kt-col-3">
        <div className="kt-seg">
          {MODES.map(([value, label]) => (
            <Link key={value} href={url(value, act)} className="kt-seg-btn" data-active={playlist === value}>
              {label}
            </Link>
          ))}
          <Link href={url("all", act)} className="kt-seg-btn kt-seg-more" data-active={playlist === "all"} aria-label="All playlists" title="All playlists">
            ⋮
          </Link>
        </div>
      </div>

      <div className="kt-seg">
        <Link href={url(playlist, "all")} className="kt-seg-btn" data-active={act === "all"}>
          All Acts
        </Link>
        <Link href={url(playlist, "latest")} className="kt-seg-btn" data-active={act !== "all"}>
          {actLabel}
        </Link>
        <Link href={url(playlist, "all")} className="kt-seg-btn kt-seg-more" aria-label="All acts" title="All acts">
          ⋮
        </Link>
      </div>
    </div>
  );
}
