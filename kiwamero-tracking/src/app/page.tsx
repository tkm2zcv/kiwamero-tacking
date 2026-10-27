import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import { HomeSearch } from "@/components/home-search";
import { Eye, LineChart, ShieldCheck } from "lucide-react";

export default async function HomePage() {
  const t = await getDict();
  return (
    <div className="py-16">
      {/* hero */}
      <div className="mx-auto max-w-2xl text-center">
        <Image src="/brand/logo.webp" alt="" width={84} height={84} className="mx-auto rounded-2xl" />
        <h1
          className="mt-6 text-4xl font-black tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Kiwamero<span style={{ color: "var(--color-action)" }}>Tracking</span>
        </h1>
        <p className="mt-3 text-secondary">{t.search.hint}</p>
        <div className="mt-8">
          <HomeSearch placeholder={t.search.placeholder} cta={t.search.cta} />
        </div>
      </div>

      {/* feature cards */}
      <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
        {[
          { icon: LineChart, title: t.tabs.overview, desc: "K/D · ACS · ADR · HS% · Win Rate" },
          { icon: Eye, title: t.nav.watchlist, desc: t.watchlist.title },
          { icon: ShieldCheck, title: t.diagnosis.title, desc: "Smurf analysis" },
        ].map((f) => (
          <div key={f.title} className="trn-card p-5">
            <f.icon className="size-6" style={{ color: "var(--color-action)" }} />
            <div className="mt-3 font-bold">{f.title}</div>
            <div className="mt-1 text-sm text-secondary">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
