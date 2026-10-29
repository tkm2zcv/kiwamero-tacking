"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Star } from "lucide-react";
import { useSession } from "@/lib/auth-client";

export function WatchlistButton({
  riotName,
  riotTag,
  puuid,
  addLabel,
  watchingLabel,
  signInLabel,
  variant = "button",
}: {
  riotName: string;
  riotTag: string;
  puuid: string;
  addLabel: string;
  watchingLabel: string;
  signInLabel: string;
  variant?: "button" | "icon";
}) {
  const { data: session, isPending } = useSession();
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    fetch(`/api/watchlist/check?name=${encodeURIComponent(riotName)}&tag=${encodeURIComponent(riotTag)}`)
      .then((r) => r.json())
      .then((d) => setWatching(!!d.watching))
      .catch(() => {});
  }, [session, riotName, riotTag]);

  async function toggle() {
    if (!session) {
      router.push("/login");
      return;
    }
    setBusy(true);
    await fetch("/api/watchlist", {
      method: watching ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riotName, riotTag, puuid }),
    }).catch(() => {});
    setWatching(!watching);
    setBusy(false);
  }

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        disabled={busy || isPending}
        className="kt-icon-btn"
        aria-label={watching ? watchingLabel : addLabel}
        title={session ? (watching ? watchingLabel : addLabel) : signInLabel}
      >
        <Star size={20} fill={watching ? "currentColor" : "none"} color={watching ? "#cbb765" : "currentColor"} />
      </button>
    );
  }

  if (isPending) {
    return (
      <button className="kt-btn kt-btn--secondary gap-2 opacity-60">
        <Eye className="size-4" />…
      </button>
    );
  }
  if (!session) {
    return (
      <button onClick={toggle} className="kt-btn kt-btn--secondary gap-2" title={signInLabel}>
        <Eye className="size-4" />
        <span className="hidden lg:inline">{addLabel}</span>
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`kt-btn ${watching ? "kt-btn--primary" : "kt-btn--secondary"} gap-2`}
    >
      {watching ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      <span className="hidden lg:inline">{watching ? watchingLabel : addLabel}</span>
    </button>
  );
}
