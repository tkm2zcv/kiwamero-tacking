"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/lib/types";
import { MatchRowClient } from "./match-row";

const PAGE = 5;

export function MatchList({
  matches,
  puuid,
  capturedAt,
  labels,
}: {
  matches: Match[];
  puuid: string;
  capturedAt?: string;
  labels: { mode: string; map: string; agent: string; loadMore: string };
}) {
  const [mode, setMode] = useState("all");
  const [map, setMap] = useState("all");
  const [agent, setAgent] = useState("all");
  const [shown, setShown] = useState(PAGE);

  const modes = useMemo(() => [...new Set(matches.map((m) => m.metadata.mode_id).filter(Boolean))], [matches]);
  const maps = useMemo(() => [...new Set(matches.map((m) => m.metadata.map).filter(Boolean))], [matches]);
  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      const me = m.players.find((p) => p.puuid === puuid);
      if (me) set.add(me.character);
    }
    return [...set];
  }, [matches, puuid]);

  const filtered = useMemo(
    () =>
      matches.filter((m) => {
        if (mode !== "all" && m.metadata.mode_id !== mode) return false;
        if (map !== "all" && m.metadata.map !== map) return false;
        if (agent !== "all") {
          const me = m.players.find((p) => p.puuid === puuid);
          if (me?.character !== agent) return false;
        }
        return true;
      }),
    [matches, mode, map, agent, puuid]
  );

  return (
    <div>
      {/* filters */}
      <div className="mb-3 flex flex-wrap gap-2">
        <FilterSelect label={labels.mode} value={mode} onChange={(v) => { setMode(v); setShown(PAGE); }} options={modes} />
        <FilterSelect label={labels.map} value={map} onChange={(v) => { setMap(v); setShown(PAGE); }} options={maps} />
        <FilterSelect label={labels.agent} value={agent} onChange={(v) => { setAgent(v); setShown(PAGE); }} options={agents} />
      </div>

      <div className="space-y-1.5">
        {filtered.slice(0, shown).map((m, i) => (
          <MatchRowClient key={m.metadata.matchid || i} match={m} puuid={puuid} capturedAt={capturedAt} />
        ))}
        {!filtered.length ? (
          <div className="trn-card p-8 text-center text-secondary">No matches.</div>
        ) : null}
      </div>

      {filtered.length > shown ? (
        <div className="mt-4 flex justify-center">
          <button onClick={() => setShown((s) => s + PAGE)} className="trn-button px-6">
            {labels.loadMore}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg px-3 text-sm font-medium text-primary outline-none"
      style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-surface-3)" }}
    >
      <option value="all">{label}</option>
      {options.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}
