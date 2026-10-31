import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { queryOne } from "@/lib/db";
import { getDict } from "@/lib/i18n/server";
import { LangSwitcher } from "./lang-switcher";
import { UserMenu } from "./user-menu";
import { SearchIcon } from "lucide-react";

export async function SiteNav() {
  const t = await getDict();
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);
  const discordAccount = session
    ? await queryOne<{ accountId: string }>(
        `SELECT "accountId" FROM "Account" WHERE "userId" = ? AND "providerId" = 'discord' LIMIT 1`,
        [session.user.id],
      ).catch(() => null)
    : null;

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
        <div className="kt-gamebar-right" />
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
          <UserMenu
            signedIn={!!session}
            name={session?.user.name}
            email={session?.user.email}
            image={session?.user.image}
            discordId={discordAccount?.accountId}
          />
        </div>
      </header>
    </>
  );
}
