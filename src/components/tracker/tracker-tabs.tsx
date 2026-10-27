"use client";

import { History, BarChart3, Trophy, ShieldCheck, Radar } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrackerTab = "matches" | "analytics" | "seasons" | "appraisal" | "smurf";

const TABS: { id: TrackerTab; label: string; count?: number; icon: typeof History }[] = [
  { id: "matches", label: "試合履歴", count: 500, icon: History },
  { id: "analytics", label: "アナリティクス", count: 337, icon: BarChart3 },
  { id: "seasons", label: "シーズンランク", count: 39, icon: Trophy },
  { id: "appraisal", label: "アカウント査定", icon: ShieldCheck },
  { id: "smurf", label: "スマーフ診断", icon: Radar },
];

export function TrackerTabs({
  active,
  onChange,
}: {
  active: TrackerTab;
  onChange: (t: TrackerTab) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-1.5 border-b border-border/50 pb-4">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  isActive ? "bg-black/20 text-primary-foreground" : "bg-secondary text-muted-foreground"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
