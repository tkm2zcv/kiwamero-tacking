import Link from "next/link";
import { Code2 } from "lucide-react";
import { Logo, Wordmark } from "./logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-card/40 backdrop-blur-xl mt-auto py-8 text-xs text-muted-foreground">
      <div className="container mx-auto max-w-7xl px-4">
        <div className="flex items-center justify-between pb-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/" className="hover:text-foreground transition-colors">
              ホーム
            </Link>
            <span className="text-border">|</span>
            <Link
              href="/developers"
              className="flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Code2 className="h-3.5 w-3.5" />
              API キー &amp; ドキュメント
            </Link>
          </nav>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/5 pt-5 text-[11px]">
          <p>© 2026 KiwameroTracker. All rights reserved.</p>
          <p>
            Not affiliated with or endorsed by Riot Games, Inc. VALORANT is a
            trademark of Riot Games.
          </p>
        </div>
      </div>
    </footer>
  );
}
