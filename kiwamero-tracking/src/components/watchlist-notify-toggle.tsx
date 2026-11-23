"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

export function WatchlistNotifyToggle({
  id,
  enabled,
  label,
  errorLabel,
}: {
  id: string;
  enabled: boolean;
  label: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notifyEnabled: !enabled }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        className="trn-button h-9 px-3 text-xs"
        disabled={busy}
        title={label}
        aria-label={label}
        onClick={() => void toggle()}
      >
        {enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
      </button>
      {failed ? <span className="sr-only" role="status">{errorLabel}</span> : null}
    </>
  );
}
