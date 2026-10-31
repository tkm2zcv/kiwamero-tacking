"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ImageSearchButton, type ImageSearchDict } from "./image-search";
import { recordSearch } from "@/lib/search-history";
import { trackerProfileUrl } from "@/lib/tracker-gg";

export function HomeSearch({ placeholder, cta, imageSearch }: { placeholder: string; cta: string; imageSearch: ImageSearchDict }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const m = q.trim().match(/^(.+?)#(.+)$/);
    if (!m) {
      setErr(true);
      return;
    }
    const local = `/valorant/profile/riot/${encodeURIComponent(m[1])}%23${encodeURIComponent(m[2])}/overview`;
    // The local profile always loads; the tracker.gg tab is an extra that only
    // appears when the account actually resolves. Reserving the tab inside the
    // user gesture keeps popup blockers quiet.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    setBusy(true);
    router.push(local);
    if (!tab) return;
    try {
      const res = await fetch(`/api/valorant/account/${encodeURIComponent(m[1])}/${encodeURIComponent(m[2])}`);
      if (res.ok) {
        recordSearch({ name: m[1], tag: m[2] });
        tab.location.href = trackerProfileUrl(m[1], m[2]);
      } else {
        tab.close();
      }
    } catch {
      tab.close();
    }
    setBusy(false);
  }

  return (
    <div className="flex items-start gap-2">
    <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2">
      <div className="relative min-w-0 flex-1">
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
      <button type="submit" disabled={busy} className="trn-button trn-button--action h-14 px-4 text-base sm:px-8">
        {cta}
      </button>
    </form>
    <ImageSearchButton t={imageSearch} />
    </div>
  );
}
