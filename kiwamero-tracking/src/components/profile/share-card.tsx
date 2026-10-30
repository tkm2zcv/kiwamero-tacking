import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import { tierIcon, playerCardArt } from "@/lib/henrik-shared";
import type { Profile, Summary, TopAgent } from "@/lib/types";
import { CopyLinkButton } from "./copy-link";

export async function ShareCard({
  profile, summary, topAgents, shareUrl,
}: {
  profile: Profile;
  summary: Summary;
  topAgents: TopAgent[];
  shareUrl: string;
}) {
  const t = await getDict();
  return (
    <div className="mx-auto max-w-lg">
      {/* shareable card */}
      <div
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "var(--color-surface-1)", border: "1px solid var(--color-surface-3)" }}
      >
        {profile.cardId ? (
          <Image
            src={playerCardArt(profile.cardId)}
            alt=""
            fill
            className="object-cover opacity-15"
          />
        ) : null}
        <div className="relative">
          <div className="flex items-center gap-3">
            <Image src="/brand/logo.webp" alt="" width={36} height={36} className="rounded" />
            <span className="text-xs font-bold uppercase tracking-widest text-secondary">Kiwamero Tracking</span>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <Image src={tierIcon(profile.currentTier)} alt="" width={64} height={64} />
            <div>
              <div className="text-2xl font-black" style={{ fontFamily: "var(--font-display)" }}>
                {profile.name}<span className="text-secondary">#{profile.tag}</span>
              </div>
              <div className="text-sm font-semibold" style={{ color: "var(--color-valorant-team-1)" }}>
                {profile.currentRank} · {profile.rr} RR
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {[
              { n: t.stats.winRate, v: `${summary.winRate.toFixed(1)}%` },
              { n: t.stats.kdRatio, v: summary.kd.toFixed(2) },
              { n: t.stats.acs, v: String(Math.round(summary.acs)) },
              { n: t.stats.headshot, v: `${Math.round(summary.hs)}%` },
            ].map((s) => (
              <div key={s.n} className="rounded-lg p-3" style={{ background: "rgba(0,0,0,.35)" }}>
                <div className="text-[10px] uppercase tracking-wider text-tertiary">{s.n}</div>
                <div className="mt-1 text-lg font-black">{s.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2">
            {topAgents.slice(0, 3).map((a) => (
              <div key={a.agent} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "rgba(0,0,0,.35)" }}>
                <Image src={a.icon} alt={a.agent} width={22} height={22} className="rounded" />
                <span className="text-xs font-semibold">{a.agent}</span>
              </div>
            ))}
            <span className="ml-auto text-[10px] text-tertiary">Lvl {profile.level} · {profile.region.toUpperCase()}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <CopyLinkButton url={shareUrl} label={t.share.copyLink} copiedLabel={t.share.copied} />
      </div>
    </div>
  );
}
