import Link from "next/link";
import { ArrowLeft, Code2 } from "lucide-react";
import { UserChip } from "@/components/user-chip";
import { SiteFooter } from "@/components/site-footer";
import { DevPortal } from "@/components/developers/dev-portal";

export const metadata = { title: "Developer Portal | KiwameroTracker" };

export default function DevelopersPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            ホームへ戻る
          </Link>
          <span className="text-border">|</span>
          <span className="flex items-center gap-1.5 rounded-md border border-cyan-400/40 bg-cyan-400/10 px-2 py-1 text-xs font-bold text-cyan-400">
            <Code2 className="h-3.5 w-3.5" />
            Developer Portal
          </span>
        </div>
        <UserChip />
      </header>
      <main className="container mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-black tracking-tight">開発者ポータル</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          公開アカウント査定 API のキー発行、動作確認、仕様確認ができます。仕入れクローラー向けです。
        </p>
        <div className="mt-8">
          <DevPortal />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
