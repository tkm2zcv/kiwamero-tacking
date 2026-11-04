import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { getDict } from "@/lib/i18n/server";

export async function ProfileNavigationGate() {
  const { access: t } = await getDict();
  return (
    <div className="kt-container kt-access-gate kt-profile-navigation">
      <section className="kt-access-card" aria-labelledby="profile-navigation-title">
        <Image src="/brand/logo.webp" alt="" width={72} height={72} className="kt-access-card__logo" />
        <div className="kt-access-card__icon"><ExternalLink size={28} aria-hidden="true" /></div>
        <h1 id="profile-navigation-title" className="kt-access-card__title">
          {t.navigationBlockedTitle}
        </h1>
        <p className="kt-access-card__body">{t.navigationBlockedBody}</p>
        <p className="kt-access-card__note">{t.navigationNote}</p>
      </section>
    </div>
  );
}
