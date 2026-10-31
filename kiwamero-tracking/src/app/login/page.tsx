import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDict } from "@/lib/i18n/server";
import { getSiteAccess } from "@/lib/site-access";
import { AccessGate } from "@/components/access-gate";
import { LoginButton } from "@/components/login-button";
import { Lock } from "lucide-react";

export default async function LoginPage() {
  const access = await getSiteAccess(await headers());
  if (access.status === "allowed") redirect("/");
  if (access.status === "denied") return <AccessGate status="denied" />;

  const t = await getDict();
  return (
    <div className="kt-container flex min-h-[60vh] items-center justify-center py-16">
      <div className="trn-card w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "var(--color-surface-2)" }}>
          <Lock className="size-5 text-secondary" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          {t.access.signInTitle}
        </h1>
        <p className="mt-1 text-sm text-secondary">{t.access.signInBody}</p>
        <LoginButton label="Sign in with Discord / Discordでログイン" />
        <p className="mt-4 text-xs text-tertiary">
          {t.access.note}
        </p>
      </div>
    </div>
  );
}
