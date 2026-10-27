"use client";

import { ChevronDown } from "lucide-react";

const FILTERS = ["Gamemodes", "Acts", "Agents", "Maps"] as const;

export function MatchFilters() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      {FILTERS.map((f) => (
        <button
          key={f}
          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3.5 py-2 text-xs font-medium text-foreground/90 hover:bg-secondary/60 transition-colors"
        >
          Show All {f}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
