"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export default function ProfileError({ retry }: { error: unknown; retry: () => void }) {
  const { t } = useT();
  // The boundary must survive even if the i18n provider itself failed.
  const p = (t.profile ?? {}) as Partial<typeof t.profile>;
  return (
    <div className="kt-container">
      <section className="kt-card" role="alert" style={{ marginTop: 28, padding: 28 }}>
        <h1 style={{ fontFamily: "var(--kt-title)", marginTop: 0 }}>
          {p.loadErrorTitle ?? "The profile could not be displayed"}
        </h1>
        <p style={{ color: "var(--kt-text-2)" }}>
          {p.loadErrorBody ?? "An unexpected error occurred. You can retry or return to search."}
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <button type="button" className="kt-btn" onClick={retry}>{p.retry ?? "Retry"}</button>
          <Link href="/" className="kt-btn kt-btn--secondary">{t.nav?.home ?? "Home"}</Link>
        </div>
      </section>
    </div>
  );
}
