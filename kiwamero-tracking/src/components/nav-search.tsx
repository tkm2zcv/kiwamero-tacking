"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";

export function NavSearch({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const m = q.trim().match(/^(.+?)#(.+)$/);
    if (!m) return;
    router.push(`/valorant/profile/riot/${encodeURIComponent(m[1])}%23${encodeURIComponent(m[2])}/overview`);
  }

  return (
    <form onSubmit={submit} className="relative hidden sm:block">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tertiary" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-56 rounded-lg pl-9 pr-3 text-sm text-primary outline-none transition-colors focus:ring-1 lg:w-72"
        style={{ background: "var(--color-surface-2)", border: "1px solid transparent" }}
        onFocus={(e) => (e.target.style.borderColor = "var(--color-action)")}
        onBlur={(e) => (e.target.style.borderColor = "transparent")}
      />
    </form>
  );
}
