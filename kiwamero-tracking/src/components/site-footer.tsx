import Link from "next/link";
import Image from "next/image";
import { getDict } from "@/lib/i18n/server";

export async function SiteFooter() {
  const t = await getDict();
  return (
    <footer className="mt-16 border-t border-black/40" style={{ background: "var(--color-main-nav-background)" }}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-4 py-10 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/logo.webp" alt="" width={40} height={40} className="rounded" />
          <div>
            <div className="font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              Kiwamero<span style={{ color: "var(--color-action)" }}>Tracking</span>
            </div>
            <div className="text-xs text-tertiary">tracker.gg-style VALORANT stats</div>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary">
          <Link href="/" className="hover:text-white">{t.nav.home}</Link>
          <Link href="/watchlist" className="hover:text-white">{t.nav.watchlist}</Link>
          <Link href="/developers" className="hover:text-white">{t.nav.developers}</Link>
        </nav>
        <p className="max-w-md text-xs text-tertiary">{t.footer.disclaimer}</p>
      </div>
    </footer>
  );
}
