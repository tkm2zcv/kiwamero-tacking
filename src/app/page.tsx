"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Logo, Wordmark } from "@/components/logo";
import { UserChip } from "@/components/user-chip";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const submit = () => {
    const v = q.trim();
    if (!v) return;
    const [name, tag] = v.includes("#")
      ? v.split("#")
      : [v, ""];
    router.push(`/tracker/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="absolute right-4 top-4 z-10">
        <UserChip />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="flex flex-col items-center gap-6">
          <Logo size="lg" glow />
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            <Wordmark />
          </h1>
          <form
            className="flex items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Player#TAG または PUUID"
              className="h-12 w-72 sm:w-80 rounded-xl border border-border bg-card/80 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition-all"
            />
            <button
              type="submit"
              className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground/80 shadow-lg shadow-black/40 hover:bg-accent hover:text-foreground transition-colors"
              aria-label="検索"
            >
              <Search className="h-5 w-5" />
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
