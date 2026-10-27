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
  return (
    <button
      className="trn-button h-9 px-3 text-xs"
      disabled={busy}
      title={label}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/watchlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ riotName: name, riotTag: tag }),
        });
        router.refresh();
      }}
    >
      {icon}
    </button>
  );
}
