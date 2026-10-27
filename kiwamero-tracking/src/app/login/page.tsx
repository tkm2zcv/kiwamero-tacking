import { getDict } from "@/lib/i18n/server";
import { LoginButton } from "@/components/login-button";
import { Lock } from "lucide-react";

export default async function LoginPage() {
  const t = await getDict();
  return (
    <div className="flex min-h-[60vh] items-center justify-center py-16">
      <div className="trn-card w-full max-w-sm p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full" style={{ background: "var(--color-surface-2)" }}>
          <Lock className="size-5 text-secondary" />
        </div>
        <h1 className="mt-4 text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          {t.nav.signIn}
        </h1>
        <p className="mt-1 text-sm text-secondary">{t.watchlist.signInCta}</p>
        <LoginButton label="Sign in with Discord / Discordでログイン" />
        <p className="mt-4 text-xs text-tertiary">
          Profiles are public — sign-in is only needed for the watchlist & API keys.
        </p>
      </div>
    </div>
  );
}
