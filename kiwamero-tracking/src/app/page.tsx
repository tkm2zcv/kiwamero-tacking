import { headers } from "next/headers";
import Link from "next/link";
import Image from "next/image";
import { Inter } from "next/font/google";
import { getDict } from "@/lib/i18n/server";
import { getSiteAccess } from "@/lib/site-access";
import { AccessGate } from "@/components/access-gate";
import { HomeSearch } from "@/components/home-search";
import { RecentSearches } from "@/components/recent-searches";
import { OrbitScripts } from "@/components/orbit-scripts";
import "./orbit.css";

// Inter v4 variable font for the hero; opsz is set manually per element.
const inter = Inter({ subsets: ["latin"], axes: ["opsz"], display: "block" });

// Adds `intro` before first paint so entrance keyframes never flash; a failsafe
// removes it even if hydration never runs.
const INTRO_BOOT = `(function(){try{
if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
var h=document.documentElement;h.classList.add("intro");
setTimeout(function(){h.classList.remove("intro","intro-play")},5000);
}catch(e){}})();`;

export default async function HomePage() {
  const access = await getSiteAccess(await headers());
  if (access.status !== "allowed") return <AccessGate status={access.status} />;
  const t = await getDict();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INTRO_BOOT }} />
      <div className="orbit" style={inter.style}>
        <video
          className="sky"
          aria-hidden="true"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/orbit/sky.png"
          src="/orbit/sky.mp4"
        />
        <div className="veil" />
        <header className="bar">
          <Link className="brand" href="/" aria-label="Kiwamero Tracking — home">
            <Image className="brand-mark" src="/brand/logo.webp" alt="" width={64} height={64} unoptimized />
            <span className="brand-word">
              Kiwamero<i>Tracking</i>
            </span>
          </Link>
          <nav className="links" aria-label="Primary">
            <Link href="/">{t.nav.home}</Link>
            <Link href="/watchlist">{t.nav.watchlist}</Link>
            <Link href="/developers">{t.nav.developers}</Link>
          </nav>
          <div className="actions">
            <Link className="btn ghost" href="/watchlist">
              {t.nav.watchlist}
            </Link>
            <Link className="btn solid" href="/developers">
              {t.nav.developers}
            </Link>
            <button
              type="button"
              className="menu"
              id="menu-btn"
              aria-label="Menu"
              aria-expanded="false"
              aria-controls="menu-sheet"
            >
              <svg viewBox="0 0 20 14" aria-hidden="true">
                <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <nav className="sheet" id="menu-sheet" aria-label="Menu">
              <Link href="/">{t.nav.home}</Link>
              <Link href="/watchlist">{t.nav.watchlist}</Link>
              <Link href="/developers">{t.nav.developers}</Link>
              <Link className="btn solid" href="/watchlist">
                {t.nav.watchlist}
              </Link>
            </nav>
          </div>
        </header>
        <div className="screen">
          <main className="hero">
            <Link className="pill" href="/watchlist">
              <span className="chip">New</span>
              <span className="pill-label">{t.search.pillLabel}</span>
              <svg viewBox="0 0 9.5 8" aria-hidden="true">
                <path
                  d="M0.7 4H8.8M5.6 0.75 8.85 4 5.6 7.25"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
            <h1>
              <span className="ln">
                <span className="ln-i">{t.search.line1}</span>
              </span>
              <span className="ln">
                <span className="ln-i">{t.search.line2}</span>
              </span>
            </h1>
            <p>{t.search.hint}</p>
            <div className="cta">
              <div className="searchbox">
                <HomeSearch
                  placeholder={t.search.placeholder}
                  cta={t.search.cta}
                  imageSearch={t.search}
                />
              </div>
              <div className="recents">
                <RecentSearches label={t.search.recent} clearLabel={t.search.clear} />
              </div>
            </div>
          </main>
        </div>
      </div>
      <OrbitScripts />
    </>
  );
}
