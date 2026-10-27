"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";

export function HomeSearch({ placeholder, cta }: { placeholder: string; cta: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const m = q.trim().match(/^(.+?)#(.+)$/);
    if (!m) {
      setErr(true);
      return;
    }
    router.push(`/valorant/profile/riot/${encodeURIComponent(m[1])}%23${encodeURIComponent(m[2])}/overview`);
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-tertiary" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setErr(false);
          }}
          placeholder={placeholder}
          className="h-14 w-full rounded-xl pl-12 pr-4 text-base outline-none"
          style={{
            background: "var(--color-surface-1)",
            border: `2px solid ${err ? "var(--color-action)" : "var(--color-surface-3)"}`,
          }}
        />
      </div>
      <button type="submit" className="trn-button trn-button--action h-14 px-8 text-base">
        {cta}
      </button>
    </form>
  );
}
