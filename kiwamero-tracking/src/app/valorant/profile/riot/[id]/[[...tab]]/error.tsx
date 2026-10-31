"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n/client";

export default function ProfileError({ retry }: { error: unknown; retry: () => void }) {
  const { t } = useT();
  return (
    <div className="kt-container">
      <section className="kt-card" role="alert" style={{ marginTop: 28, padding: 28 }}>
        <h1 style={{ fontFamily: "var(--kt-title)", marginTop: 0 }}>{t.profile.loadErrorTitle}</h1>
        <p style={{ color: "var(--kt-text-2)" }}>{t.profile.loadErrorBody}</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <button type="button" className="kt-btn" onClick={retry}>{t.profile.retry}</button>
          <Link href="/" className="kt-btn kt-btn--secondary">{t.nav.home}</Link>
        </div>
      </section>
    </div>
  );
}
