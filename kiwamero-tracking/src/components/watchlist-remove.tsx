"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useT } from "@/lib/i18n/client";
import { watchlistRemoveBody } from "@/lib/watchlist-copy";
import { WatchlistConfirmDialog } from "./watchlist-confirm";

export function WatchlistRemoveButton({
  name, tag, label, icon,
}: {
  name: string; tag: string; label: string; icon: ReactNode;
}) {
  const router = useRouter();
  const { t } = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const playerLabel = `${name}#${tag}`;

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/watchlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riotName: name, riotTag: tag }),
      });
      if (res.ok) {
        setConfirming(false);
        router.refresh();
        return;
      }
      setError(t.watchlist.removeError);
    } catch {
      setError(t.watchlist.removeError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="trn-button h-9 px-3 text-xs"
        disabled={busy}
        title={label}
        aria-label={label}
        aria-haspopup="dialog"
        onClick={() => {
          setError("");
          setConfirming(true);
        }}
      >
        {icon}
      </button>
      <WatchlistConfirmDialog
        open={confirming}
        playerLabel={playerLabel}
        title={t.watchlist.removeTitle}
        body={watchlistRemoveBody(t.watchlist.removeBody, playerLabel)}
        confirmLabel={t.watchlist.removeConfirm}
        cancelLabel={t.watchlist.removeCancel}
        busyLabel={t.watchlist.removeBusy}
        closeLabel={t.watchlist.removeCancel}
        busy={busy}
        error={error}
        onCancel={() => setConfirming(false)}
        onConfirm={() => void remove()}
      />
      <span className="sr-only" role="status">{error}</span>
    </>
  );
}
