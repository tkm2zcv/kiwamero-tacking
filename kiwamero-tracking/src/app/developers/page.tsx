import { getDict } from "@/lib/i18n/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { DevPortal } from "@/components/developers/dev-portal";

export const metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const t = await getDict();
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  return (
    <div className="kt-container py-10">
      <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
        {t.developers.title}
      </h1>
      <p className="mt-2 text-secondary">{t.developers.subtitle}</p>
      <DevPortal signedIn={!!session} labels={t.developers} />
    </div>
  );
}
