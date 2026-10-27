"use client";

import { useState } from "react";
import { Key, Play, BookOpen, Copy, Check } from "lucide-react";
import type { Dict } from "@/lib/i18n/dict";

const ENDPOINTS = [
  { method: "GET", path: "/api/valorant/account/{name}/{tag}", desc: "Player account info: level, card, region" },
  { method: "GET", path: "/api/valorant/mmr/{name}/{tag}", desc: "Current rank, RR, Elo, leaderboard position" },
  { method: "GET", path: "/api/valorant/matches/{name}/{tag}", desc: "Recent match history (HenrikDev format)" },
  { method: "GET", path: "/api/valorant/mmr-history/{name}/{tag}", desc: "Rank progression across acts" },
];

export function DevPortal({ signedIn, labels }: { signedIn: boolean; labels: Dict["developers"] }) {
  const [tab, setTab] = useState<"key" | "play" | "docs">("key");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playPath, setPlayPath] = useState(ENDPOINTS[0].path);
  const [playOut, setPlayOut] = useState("");

  async function generate() {
    setBusy(true);
    const r = await fetch("/api/keys", { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setKey(d.key ?? null);
    setBusy(false);
  }

  async function run() {
    setPlayOut("Loading…");
    const r = await fetch(playPath.replace("{name}", "Meiy").replace("{tag}", "B3L"));
    const txt = await r.text();
    setPlayOut(txt.slice(0, 4000));
  }

  const tabs = [
    { id: "key" as const, icon: Key, label: labels.apiKey },
    { id: "play" as const, icon: Play, label: labels.playground },
    { id: "docs" as const, icon: BookOpen, label: labels.docs },
  ];

  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b" style={{ borderColor: "var(--color-surface-3)" }}>
        {tabs.map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold ${tab === x.id ? "profile-tab--active profile-tab" : "text-secondary"}`}
          >
            <x.icon className="size-4" />
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "key" ? (
          <div className="trn-card max-w-xl p-6">
            <h3 className="font-bold">{labels.apiKey}</h3>
            {!signedIn ? (
              <p className="mt-2 text-sm text-secondary">Sign in with Discord to issue API keys.</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-secondary">One key per request — stored hashed.</p>
                <button onClick={generate} disabled={busy} className="trn-button trn-button--action mt-4 h-10 px-5">
                  {busy ? "…" : labels.generate}
                </button>
                {key ? (
                  <div className="mt-4 flex items-center gap-2 rounded-lg p-3" style={{ background: "var(--color-surface-2)" }}>
                    <code className="flex-1 truncate text-sm">{key}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(key); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                      className="text-secondary hover:text-white"
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        ) : null}

        {tab === "play" ? (
          <div className="trn-card p-6">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={playPath}
                onChange={(e) => setPlayPath(e.target.value)}
                className="h-10 rounded-lg px-3 text-sm"
                style={{ background: "var(--color-surface-2)" }}
              >
                {ENDPOINTS.map((e) => (
                  <option key={e.path} value={e.path}>{e.path}</option>
                ))}
              </select>
              <button onClick={run} className="trn-button trn-button--action h-10 px-5">Run</button>
            </div>
            <pre className="mt-4 max-h-96 overflow-auto rounded-lg p-4 text-xs" style={{ background: "#000" }}>
              {playOut || "// output"}
            </pre>
          </div>
        ) : null}

        {tab === "docs" ? (
          <div className="trn-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-tertiary" style={{ background: "rgba(0,0,0,.3)" }}>
                  <th className="px-4 py-2">{labels.method}</th>
                  <th className="px-4 py-2">{labels.endpoint}</th>
                  <th className="px-4 py-2">{labels.description}</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.path} className="border-t" style={{ borderColor: "rgba(255,255,255,.05)" }}>
                    <td className="px-4 py-2.5"><span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: "var(--color-surface-3)" }}>{e.method}</span></td>
                    <td className="px-4 py-2.5 font-mono text-xs">{e.path}</td>
                    <td className="px-4 py-2.5 text-secondary">{e.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="border-t p-4 text-xs text-tertiary" style={{ borderColor: "rgba(255,255,255,.05)" }}>
              Data via HenrikDev unofficial API. Rate limits apply.
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
