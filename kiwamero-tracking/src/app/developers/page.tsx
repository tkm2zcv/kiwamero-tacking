import { getDict } from "@/lib/i18n/server";
import { headers } from "next/headers";
import { getSiteAccess } from "@/lib/site-access";
import { AccessGate } from "@/components/access-gate";
import { DevPortal } from "@/components/developers/dev-portal";

export const metadata = { title: "Developers" };

export default async function DevelopersPage() {
  const access = await getSiteAccess(await headers());
  if (access.status !== "allowed") return <AccessGate status={access.status} />;
  const t = await getDict();
  return (
    <div className="kt-container py-10">
      <h1 className="text-3xl font-black" style={{ fontFamily: "var(--font-display)" }}>
        {t.developers.title}
      </h1>
      <p className="mt-2 text-secondary">{t.developers.subtitle}</p>
      <DevPortal signedIn labels={t.developers} />
    </div>
  );
}
