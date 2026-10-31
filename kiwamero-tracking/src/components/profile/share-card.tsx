import Image from "next/image";
import { getDict } from "@/lib/i18n/server";
import type { ShareCardModel } from "@/lib/share-card-data";
import { CopyLinkButton } from "./copy-link";

const BRAND_BLUE = "#0155fd";
const BRAND_BLUE_TEXT = "#3a86ff";
const BRAND_BLUE_SOFT = "rgba(1, 85, 253, 0.32)";

export async function ShareCard({
  card,
  shareUrl,
}: {
  card: ShareCardModel;
  shareUrl: string;
}) {
  const t = await getDict();
  const noStats = card.matchesAvailable <= 0;
  const topStats = [
    { label: "K/D", value: noStats ? "—" : card.stats.kd.toFixed(2) },
    { label: "HS%", value: noStats ? "—" : card.stats.hs.toFixed(2) },
    { label: "ADR", value: noStats ? "—" : card.stats.adr.toFixed(2) },
    { label: "ACS", value: noStats ? "—" : card.stats.acs.toFixed(2) },
    { label: "Win %", value: noStats ? "—" : card.stats.winRate.toFixed(2) },
    { label: "Matches", value: card.stats.matches.toLocaleString("en-US") },
    { label: "Wins", value: card.stats.wins.toLocaleString("en-US") },
    { label: "Losses", value: card.stats.losses.toLocaleString("en-US") },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      {/* shareable card */}
      <div
        className="relative overflow-hidden rounded-2xl p-8"
        style={{
          background: "linear-gradient(135deg, #101923 0%, #0b1119 100%)",
          border: `1px solid ${BRAND_BLUE_SOFT}`,
          color: "#eef8ff",
        }}
      >
        <div className="text-4xl font-medium" style={{ color: BRAND_BLUE_TEXT, fontFamily: "var(--font-saira), Saira, sans-serif" }}>
          {card.name}<span>#{card.tag}</span>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-[190px_1fr_240px]">
          <div>
            <div className="h-[180px] w-[180px] overflow-hidden border-4" style={{ borderColor: BRAND_BLUE, background: "#172433" }}>
              {card.avatarUrl ? (
                <Image src={card.avatarUrl} alt="" width={180} height={180} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="mt-5 text-4xl" style={{ color: BRAND_BLUE_TEXT }}>lvl {card.level || "—"}</div>
            <div className="mt-1 text-3xl" style={{ color: BRAND_BLUE_TEXT }}>{card.region}</div>
          </div>

          <div className="grid content-start grid-cols-2 gap-4 lg:grid-cols-4">
            {topStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg px-3 py-4 text-center"
                style={{ background: "#2b3846", border: "1px solid rgba(148,184,206,.18)" }}
              >
                <div className="text-3xl" style={{ color: BRAND_BLUE_TEXT }}>{stat.value}</div>
                <div className="mt-1 text-2xl" style={{ color: BRAND_BLUE_TEXT }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            {card.rankIconUrl ? (
              <Image src={card.rankIconUrl} alt="" width={190} height={190} className="mx-auto object-contain" />
            ) : null}
            <div className="mt-4 text-4xl" style={{ color: BRAND_BLUE_TEXT }}>{card.rankName}</div>
            <div className="mt-1 text-3xl" style={{ color: BRAND_BLUE_TEXT }}>
              {Number.isFinite(card.rr) ? `${card.rr.toLocaleString("en-US")}RR` : "—"}
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4 border-t pt-6" style={{ borderColor: "rgba(148,184,206,.16)" }}>
          <span className="text-3xl" style={{ color: BRAND_BLUE_TEXT }}>≡</span>
          <span className="text-3xl" style={{ color: BRAND_BLUE_TEXT }}>{card.server}</span>
          <span className="text-sm font-semibold" style={{ color: "#9fb3c3" }}>
            {card.actLabel} · {card.playlistLabel} · {card.matchesAvailable.toLocaleString("en-US")} recorded matches
          </span>
          <span className="ml-auto inline-flex items-center gap-3 text-2xl" style={{ color: BRAND_BLUE_TEXT }}>
            Kiwamero Tracking
            <Image src="/brand/logo.webp" alt="" width={44} height={44} />
          </span>
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <CopyLinkButton url={shareUrl} label={t.share.copyLink} copiedLabel={t.share.copied} />
      </div>
    </div>
  );
}
