"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function RefreshProfileButton({ inline = false }: { inline?: boolean }) {
  const router = useRouter();
  const { t } = useT();
  const [pending, startTransition] = useTransition();
  const button = (
      <button
        type="button"
        className={inline ? "kt-btn kt-btn--secondary" : "kt-hero-updater-refresh"}
        aria-label={inline ? t.profile.retry : "Refresh profile data"}
        title={inline ? t.profile.retry : "Refresh profile data"}
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw size={20} className={pending ? "animate-spin" : ""} />
        {inline ? t.profile.retry : null}
      </button>
  );
  if (inline) return button;
  return (
    <div className="kt-hero-updater">
      <span><i className="kt-hero-updater-live" />Refresh profile</span>
      {button}
    </div>
  );
}
