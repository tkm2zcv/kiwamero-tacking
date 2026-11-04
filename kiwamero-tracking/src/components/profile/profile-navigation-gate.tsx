import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { getDict } from "@/lib/i18n/server";

export async function ProfileNavigationGate({ href }: { href?: string }) {
  const { access: t } = await getDict();
  return (
    <div className="kt-container kt-access-gate kt-profile-navigation">
      <section className="kt-access-card" aria-labelledby="profile-navigation-title">
        <Image src="/brand/logo.webp" alt="" width={72} height={72} className="kt-access-card__logo" />
        <div className="kt-access-card__icon"><ExternalLink size={28} aria-hidden="true" /></div>
        <h1 id="profile-navigation-title" className="kt-access-card__title">
          {href ? t.navigationTitle : t.navigationBlockedTitle}
        </h1>
        <p className="kt-access-card__body">{href ? t.navigationBody : t.navigationBlockedBody}</p>
        {href ? (
          // A normal link avoids Next prefetch and requires an actual click before paid work.
          <a href={href} className="kt-btn kt-btn--primary kt-access-card__action" data-profile-continue>
            {t.navigationContinue}
          </a>
        ) : null}
        <p className="kt-access-card__note">{t.navigationNote}</p>
      </section>
    </div>
  );
}
