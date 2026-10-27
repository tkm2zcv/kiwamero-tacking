"use client";

import { useState } from "react";
import { Key, Play, FileText, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type DevTab = "keys" | "playground" | "docs";
const TABS: { id: DevTab; label: string; icon: typeof Key }[] = [
  { id: "keys", label: "APIキー", icon: Key },
  { id: "playground", label: "プレイグラウンド", icon: Play },
  { id: "docs", label: "ドキュメント", icon: FileText },
];

export function DevPortal() {
  const [tab, setTab] = useState<DevTab>("keys");
  const [keyName, setKeyName] = useState("");

  return (
    <>
      <div className="mb-6 flex items-center gap-1.5 border-b border-border/50">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px",
                tab === t.id
                  ? "border-cyan-400 text-cyan-400"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "keys" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-card p-5">
            <h3 className="mb-3 text-sm font-bold">新しいAPIキー</h3>
            <div className="flex gap-3">
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="例: Discord Bot"
                className="h-11 flex-1 rounded-lg border border-border bg-background/60 px-3.5 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30 transition-all"
              />
              <button className="flex items-center gap-1.5 rounded-lg bg-secondary px-4 text-sm font-semibold hover:bg-accent transition-colors">
                <Plus className="h-4 w-4" />
                発行
              </button>
            </div>
          </div>
          <div className="flex h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-card/40 text-muted-foreground">
            <Key className="h-6 w-6 rotate-45" />
            <p className="text-xs">キーはまだありません</p>
          </div>
        </div>
      )}

      {tab === "playground" && (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="mb-1 text-sm font-bold">API プレイグラウンド</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            発行したAPIキーで実際のリクエストを試せます。
          </p>
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
            先にAPIキーを発行してください
          </div>
        </div>
      )}

      {tab === "docs" && (
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="mb-1 text-sm font-bold">API ドキュメント</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            アカウント査定APIのエンドポイント仕様。
          </p>
          <div className="space-y-2 font-mono text-xs">
            <Endpoint method="GET" path="/api/v1/appraisal/{puuid}" desc="アカウント査定結果を取得" />
            <Endpoint method="GET" path="/api/v1/tracker/{name}/{tag}" desc="プレイヤー戦績を取得" />
            <Endpoint method="GET" path="/api/v1/matches/{puuid}" desc="試合履歴を取得" />
          </div>
        </div>
      )}
    </>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3.5 py-2.5">
      <span className="rounded bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
        {method}
      </span>
      <code className="text-foreground/90">{path}</code>
      <span className="ml-auto font-sans text-[11px] text-muted-foreground">{desc}</span>
    </div>
  );
}
