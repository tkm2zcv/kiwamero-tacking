import Image from "next/image";
import { LockKeyhole, ShieldAlert } from "lucide-react";
import { getDict } from "@/lib/i18n/server";
import type { SiteAccessStatus } from "@/lib/site-access";
import { LoginButton, SignOutButton } from "./login-button";

export async function AccessGate({ status }: { status: Exclude<SiteAccessStatus, "allowed"> }) {
  const t = await getDict();
  const denied = status === "denied";
  const Icon = denied ? ShieldAlert : LockKeyhole;

  return (
    <div className="kt-container kt-access-gate">
      <section className="kt-access-card" aria-labelledby="access-gate-title">
        <Image src="/brand/logo.webp" alt="" width={72} height={72} className="kt-access-card__logo" />
        <div className="kt-access-card__icon" data-denied={denied}>
          <Icon size={28} />
        </div>
        <h1 id="access-gate-title" className="kt-access-card__title">
          {denied ? t.access.deniedTitle : t.access.signInTitle}
        </h1>
        <p className="kt-access-card__body">
          {denied ? t.access.deniedBody : t.access.signInBody}
        </p>
        {denied ? (
          <SignOutButton label={t.access.switchAccount} className="kt-btn kt-btn--primary kt-access-card__action" />
        ) : (
          <LoginButton label={t.access.signIn} />
        )}
        <p className="kt-access-card__note">{t.access.note}</p>
      </section>
    </div>
  );
}
