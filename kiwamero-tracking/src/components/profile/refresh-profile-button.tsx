"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshProfileButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="kt-hero-updater">
      <span><i className="kt-hero-updater-live" />Refresh profile</span>
      <button
        type="button"
        className="kt-hero-updater-refresh"
        aria-label="Refresh profile data"
        title="Refresh profile data"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw size={20} className={pending ? "animate-spin" : ""} />
      </button>
    </div>
  );
}
