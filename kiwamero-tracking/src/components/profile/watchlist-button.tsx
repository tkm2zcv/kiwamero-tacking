"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSession } from "@/lib/auth-client";

export function WatchlistButton({
  riotName,
  riotTag,
  puuid,
  addLabel,
  watchingLabel,
  signInLabel,
}: {
  riotName: string;
  riotTag: string;
  puuid: string;
  addLabel: string;
  watchingLabel: string;
  signInLabel: string;
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

  if (isPending) {
    return <button className="trn-button h-10 gap-2 text-sm opacity-60"><Eye className="size-4" />…</button>;
  }
  if (!session) {
    return (
      <button onClick={toggle} className="trn-button h-10 gap-2 text-sm" title={signInLabel}>
        <Eye className="size-4" />
        <span className="hidden lg:inline">{addLabel}</span>
      </button>
    );
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`trn-button h-10 gap-2 text-sm ${watching ? "trn-button--action" : ""}`}
    >
      {watching ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      <span className="hidden lg:inline">{watching ? watchingLabel : addLabel}</span>
    </button>
  );
}
