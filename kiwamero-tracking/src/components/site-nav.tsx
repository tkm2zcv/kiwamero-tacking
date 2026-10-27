import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LangSwitcher } from "./lang-switcher";
import { NavSearch } from "./nav-search";
import { Eye, Crosshair, LogOut } from "lucide-react";
import Image from "next/image";

export async function SiteNav() {
  const t = await getDict();
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  return (
    <>
      {/* game bar (black strip) */}
      <div
        className="flex items-center justify-between px-4 text-xs"
        style={{ background: "var(--color-game-bar-background)", height: "var(--game-bar-height)" }}
      >
        <div className="flex items-center gap-4">
          <span className="font-bold tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
            KIWAMERO
          </span>
          <span className="text-secondary hidden sm:inline">Tracking Network</span>
        </div>
        <div className="flex items-center gap-3 text-secondary">
          <span className="hidden md:inline">VALORANT</span>
          <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ background: "var(--color-action)", color: "#fff" }}>
            BETA
          </span>
        </div>
      </div>

      {/* main nav */}
      <header
        className="sticky top-0 z-40 border-b border-black/40"
        style={{ background: "var(--color-main-nav-background)" }}
      >
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/brand/logo.webp" alt="Kiwamero Tracking" width={36} height={36} className="rounded" />
            <span className="hidden text-lg font-extrabold tracking-tight sm:block" style={{ fontFamily: "var(--font-display)" }}>
              Kiwamero<span style={{ color: "var(--color-action)" }}>Tracking</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            <NavLink href="/" label={t.nav.home} />
            <NavLink href="/watchlist" label={t.nav.watchlist} icon={<Eye className="size-4" />} />
            <NavLink href="/developers" label={t.nav.developers} icon={<Crosshair className="size-4" />} />
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NavSearch placeholder={t.search.placeholder} />
            <LangSwitcher />
            {session ? (
              <div className="flex items-center gap-2">
                {session.user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={session.user.image} alt="" className="size-8 rounded-full" />
                ) : null}
                <Link href="/api/auth/sign-out" className="trn-button h-9 px-3 text-xs" title={t.nav.signOut}>
                  <LogOut className="size-4" />
                </Link>
              </div>
            ) : (
              <Link href="/login" className="trn-button trn-button--action h-9 px-4 text-xs">
                {t.nav.signIn}
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded px-3 py-2 text-sm font-semibold text-secondary transition-colors hover:text-white"
    >
      {icon}
      {label}
    </Link>
  );
}
