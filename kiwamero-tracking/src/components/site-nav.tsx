import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getDict } from "@/lib/i18n/server";
import { LangSwitcher } from "./lang-switcher";
import { LogOut, SearchIcon } from "lucide-react";

export async function SiteNav() {
  const t = await getDict();
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);

  return (
    <>
      <nav className="kt-gamebar" aria-label="Games">
        <Link href="/" className="kt-gamebar-brand">
          <span className="kt-gamebar-brandmark">極</span>
          <span className="kt-gamebar-brandname">
            KIWAMERO<span>.TRACKING</span>
          </span>
        </Link>
        <div className="kt-gamebar-games">
          <span className="kt-gamebar-game" data-active="true">
            <span className="kt-gamebar-v">V</span> VALORANT
          </span>
        </div>
        <div className="kt-gamebar-right">
          {session ? (
            <Link href="/api/auth/sign-out" className="kt-gamebar-signin" aria-label={t.nav.signOut}>
              <LogOut size={18} />
            </Link>
          ) : (
            <Link href="/login" className="kt-gamebar-signin">
              Sign In
            </Link>
          )}
        </div>
      </nav>

      <header className="kt-nav">
        <div className="kt-nav-search">
          <Link href="/" className="kt-nav-searchbox" aria-label="Search players">
            <span className="kt-nav-searchbox-mark" aria-hidden="true"><i /></span>
            <span className="kt-nav-searchbox-glyph">
              <SearchIcon size={20} />
            </span>
            <span>Search</span>
          </Link>
        </div>

        <nav className="kt-nav-links" aria-label="VALORANT">
          <Link href="/" className="kt-nav-link">
            {t.nav.home}
          </Link>
        </nav>

        <div className="kt-nav-right">
          <LangSwitcher />
        </div>
      </header>
    </>
  );
}
