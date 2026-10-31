"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSession } from "@/lib/auth-client";

type WatchStatus = "idle" | "error" | "full";

export function WatchlistButton({
  riotName,
  riotTag,
  puuid,
  region,
  addLabel,
  watchingLabel,
  signInLabel,
  variant = "button",
}: {
  riotName: string;
  riotTag: string;
  puuid: string;
  region?: string | null;
  addLabel: string;
  watchingLabel: string;
  signInLabel: string;
  variant?: "button" | "icon";
}) {
  const { data: session, isPending } = useSession();
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<WatchStatus>("idle");
  const router = useRouter();

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    fetch(`/api/watchlist/check?name=${encodeURIComponent(riotName)}&tag=${encodeURIComponent(riotTag)}`, {
      signal: controller.signal,
    })
      .then(async (r) => (r.ok ? r.json() : null))
      .then((d) => setWatching(!!d?.watching))
      .catch(() => {});
    return () => controller.abort();
  }, [session, riotName, riotTag]);

  async function toggle() {
    if (!session) {
      router.push("/login");
      return;
    }
    setBusy(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/watchlist", {
        method: watching ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotName, riotTag, puuid, region }),
      });
      if (res.ok) {
        setWatching(!watching);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus(data?.error === "watchlist_full" ? "full" : "error");
      }
    } catch {
      setStatus("error");
    } finally {
      setBusy(false);
    }
  }

  const statusText = status === "full" ? "Watchlist is full" : status === "error" ? "Could not update watchlist" : "";
  const label = watching ? watchingLabel : addLabel;
  const title = statusText || (session ? label : signInLabel);

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={toggle}
          disabled={busy || isPending}
          className="kt-icon-btn kt-icon-btn--watch"
          data-watching={watching}
          aria-label={label}
          aria-pressed={watching}
          title={title}
        >
          {watching ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
        <span className="sr-only" role="status">{statusText}</span>
      </>
    );
  }

  if (isPending) {
    return (
      <button className="kt-btn kt-btn--secondary gap-2 opacity-60" disabled>
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
    <>
      <button
        onClick={toggle}
        disabled={busy}
        className={`kt-btn ${watching ? "kt-btn--primary" : "kt-btn--secondary"} gap-2`}
        title={title}
        aria-pressed={watching}
      >
        {watching ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        <span className="hidden lg:inline">{label}</span>
      </button>
      <span className="sr-only" role="status">{statusText}</span>
    </>
  );
}
