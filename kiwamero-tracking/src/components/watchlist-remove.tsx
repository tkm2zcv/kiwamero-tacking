"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export function WatchlistRemoveButton({
  name, tag, label, icon,
}: {
  name: string; tag: string; label: string; icon: ReactNode;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  return (
    <>
      <button
        className="trn-button h-9 px-3 text-xs"
        disabled={busy}
        title={error || label}
        aria-label={label}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            const res = await fetch("/api/watchlist", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ riotName: name, riotTag: tag }),
            });
            if (res.ok) {
              router.refresh();
              return;
            }
            setError("Could not remove this player.");
          } catch {
            setError("Could not remove this player.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {icon}
      </button>
      <span className="sr-only" role="status">{error}</span>
    </>
  );
}
