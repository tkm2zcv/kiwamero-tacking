"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface ActMenuItem {
  label: string;
  href: string;
  active?: boolean;
}

const dots = (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="text-current" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2m0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2m0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2"
    />
  </svg>
);

/**
 * tracker.gg's act dropdown: `⋯` trigger that opens a `z-dropdown` portal-style
 * panel listing the acts available on the profile. `variant="seg"` renders the
 * segmented-bar button; `variant="filter"` renders the `v3-filter` chip used
 * inside card filter rows (e.g. the Performance "Act" filter).
 */
export function ActMenu({
  items,
  variant = "seg",
  label = "Act",
}: {
  items: ActMenuItem[];
  variant?: "seg" | "filter";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menu = open && items.length > 0 && (
    <div className="kt-menu-panel z-dropdown pt-1">
      <div className="minimal-scrollbar max-h-80 min-w-32 max-w-64 overflow-y-auto overscroll-none rounded-4 bg-surface-2 pb-2 text-14 leading-5/4 shadow-card pt-2">
        {items.map((item) => (
          <Link
            key={`${item.label}-${item.href}`}
            href={item.href}
            onClick={() => setOpen(false)}
            className="flex h-10 cursor-pointer items-center gap-2 border-l-2 border-transparent pl-3.5 pr-4 text-primary no-underline hover:border-action hover:bg-action/10"
            style={item.active ? { borderLeftColor: "var(--color-action)" } : undefined}
          >
            <span className="h-max truncate font-medium text-14">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );

  if (variant === "filter") {
    return (
      <div ref={rootRef} className="relative inline-flex min-w-40">
        <button type="button" className="v3-filter" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {label}
          {dots}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="kt-seg-menu">
      <button
        type="button"
        className="kt-seg-btn"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="More acts"
        title="More acts"
      >
        ⋮
      </button>
      {menu}
    </div>
  );
}
