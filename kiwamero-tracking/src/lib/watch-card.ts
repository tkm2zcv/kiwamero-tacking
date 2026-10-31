/**
 * Server-side match card renderer for Discord watch notifications.
 * satori (element tree -> SVG) + @resvg/resvg-wasm (SVG -> PNG).
 * Works in Node dev and Cloudflare Workers: the wasm binary is read from
 * node_modules when available, otherwise fetched from the app's own origin.
 */

import type { NewMatchSummary } from "./watch-core";

// Same tier table as henrik-shared.ts (kept inline so this module stays
// self-contained for both the Next bundle and direct Node execution).
const TIER_TABLE_UUID = "03621f52-342b-cf4e-4f86-9350a49c6d04";
const tierIcon = (tier: number, size: "small" | "large" = "small") =>
  `https://media.valorant-api.com/competitivetiers/${TIER_TABLE_UUID}/${tier}/${size}icon.png`;

const CARD_W = 880;
const CARD_H = 660;

const BRAND = "#0155fd";
const BRAND_LIGHT = "#3a86ff";
const BG = "#0b0f1d";
const PANEL = "#10162b";
const EDGE = "#1e2a4a";
const TEXT = "#e8ecf5";
const MUTED = "#8b96b3";
const WIN = "#16e5b4";
const LOSS = "#e4485d";

type El = { type: string; props: Record<string, unknown> };
const el = (type: string, props: Record<string, unknown>, ...children: unknown[]): El => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});
const text = (value: string, style: Record<string, unknown>): El =>
  el("div", { style }, value);

let wasmPromise: Promise<BufferSource> | null = null;
let wasmInitPromise: Promise<unknown> | null = null;
type CardFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };
let fontPromise: Promise<CardFont[]> | null = null;
const iconCache = new Map<string, Promise<string | null>>();

// Upstream (HenrikDev/Riot) icon URLs are CDN-hosted game assets; anything
// else is not a legitimate fetch target for server-side rendering.
const ICON_HOSTS = new Set([
  "media.valorant-api.com",
  "trackercdn.com",
  "imgsvc.trackercdn.com",
  "titles.trackercdn.com",
]);
const MAX_ICON_BYTES = 512 * 1024;
const MAX_FONT_BYTES = 4 * 1024 * 1024;

async function loadWasm(): Promise<BufferSource> {
  wasmPromise ??= (async () => {
    try {
      const fs = await import("node:fs/promises");
      const url = new URL("../../node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url);
      return await fs.readFile(url);
    } catch {
      const base =
        process.env.APP_BASE_URL ??
        process.env.BETTER_AUTH_URL ??
        "https://tracking.kiwamero.dev";
      const res = await fetch(`${base.replace(/\/$/, "")}/resvg.wasm`);
      if (!res.ok) throw new Error(`wasm fetch ${res.status}`);
      return res.arrayBuffer();
    }
  })();
  return wasmPromise;
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// Exported for tests — internal rendering helper.
export async function iconData(url: string | undefined): Promise<string | null> {
  if (!url) return null;
  let p = iconCache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const u = new URL(url);
        if (u.protocol !== "https:" || !ICON_HOSTS.has(u.hostname)) return null;
        const r = await fetch(u, { redirect: "error" });
        if (!r.ok) return null;
        const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
        if (!type.startsWith("image/")) return null;
        const len = Number(r.headers.get("content-length") ?? 0);
        if (len > MAX_ICON_BYTES) return null;
        const b = await r.arrayBuffer();
        if (b.byteLength > MAX_ICON_BYTES) return null;
        return `data:${type};base64,${b64(b)}`;
      } catch {
        return null;
      }
    })();
    if (iconCache.size >= 128) iconCache.delete(iconCache.keys().next().value!);
    iconCache.set(url, p);
  }
  return p;
}

/**
 * Google Fonts css2 with no text= subset: player names are owner-private
 * watchlist data and must never be sent to Google. The css2 URL is constant,
 * so the (larger, full-charset) font set is cached once per isolate.
 */
// Exported for tests — internal rendering helper.
export function loadFonts(): Promise<CardFont[]> {
  fontPromise ??= (async () => {
    const css = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700",
      { headers: { "user-agent": "Mozilla/4.0" } },
    ).then((r) => r.text());
    const blocks = css.split("@font-face").slice(1);
    return Promise.all(
      blocks.map(async (block) => {
        const weight = (Number(block.match(/font-weight:\s*(\d+)/)?.[1] ?? 400) === 700 ? 700 : 400) as 400 | 700;
        const url = block.match(/url\((https:[^)]+)\)/)?.[1];
        if (!url) throw new Error("font url missing");
        const u = new URL(url);
        if (u.protocol !== "https:" || u.hostname !== "fonts.gstatic.com") {
          throw new Error("font url rejected");
        }
        const res = await fetch(u, { redirect: "error" });
        if (!res.ok) throw new Error(`font fetch ${res.status}`);
        const data = await res.arrayBuffer();
        if (data.byteLength > MAX_FONT_BYTES) throw new Error("font too large");
        return { name: "Noto Sans JP", data, weight, style: "normal" as const };
      }),
    );
  })().catch(() => {
    fontPromise = null;
    throw new Error("fonts unavailable");
  });
  return fontPromise;
}

function kdColor(kills: number, deaths: number): string {
  const kd = deaths ? kills / deaths : kills;
  return kd >= 1 ? WIN : LOSS;
}

function kdValue(kills: number, deaths: number): string {
  return (deaths ? kills / deaths : kills).toFixed(2);
}

function statCell(label: string, value: string, color: string): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        background: "#0e1530",
        border: `1px solid ${EDGE}`,
        borderRadius: 12,
        padding: "14px 8px",
      },
    },
    text(label, { fontSize: 16, color: MUTED, letterSpacing: 2 }),
    text(value, { fontSize: 34, fontWeight: 700, color }),
  );
}

function memberCard(
  member: { name: string; tag: string; agent?: string; rankTier?: number; kills: number; deaths: number; assists: number; season?: { kills: number; deaths: number; matches: number } | null; encountersAct?: number; encountersAll?: number },
  icon: string | null,
  rankIcon: string | null,
  partyColor: string,
): El {
  const seasonKd = member.season ? kdValue(member.season.kills, member.season.deaths) : null;
  const met = member.encountersAll != null ? `met ${member.encountersAct ?? 0}/${member.encountersAll}` : null;
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 18,
        background: PANEL,
        border: `1px solid ${EDGE}`,
        borderLeft: `5px solid ${partyColor}`,
        borderRadius: 14,
        padding: "16px 22px",
      },
    },
    icon
      ? el("img", { src: icon, width: 74, height: 74, style: { borderRadius: 10 } })
      : el("div", { style: { width: 74, height: 74, borderRadius: 10, background: EDGE } }),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 } },
      text(`${member.name}#${member.tag}`, {
        fontSize: 27, fontWeight: 700, color: TEXT,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 470,
      }),
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflow: "hidden", whiteSpace: "nowrap" } },
        text(`${member.agent ?? "?"}`, { fontSize: 17, color: MUTED, flexShrink: 0 }),
        rankIcon ? el("img", { src: rankIcon, width: 24, height: 24 }) : null,
        seasonKd ? text(`· szn K/D ${seasonKd}`, { fontSize: 17, color: BRAND_LIGHT, flexShrink: 0 }) : null,
        met ? text(`· ${met}`, { fontSize: 17, color: MUTED, flexShrink: 0 }) : null,
      ),
    ),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } },
      text(`${member.kills}/${member.deaths}/${member.assists}`, { fontSize: 26, fontWeight: 700, color: TEXT }),
      text(`K/D ${kdValue(member.kills, member.deaths)}`, {
        fontSize: 19,
        fontWeight: 700,
        color: kdColor(member.kills, member.deaths),
      }),
    ),
  );
}

/**
 * Render one vertical PNG card per match: the watched player plus only their
 * premade members — the point of the notification is who they queued with.
 * K/D values are colour-coded. Returns null on any failure so the caller can
 * fall back to plain embeds.
 */
export async function renderWatchCard(
  match: NewMatchSummary,
  watched: { name: string; tag: string },
): Promise<Uint8Array | null> {
  try {
    const [{ default: satori }, resvgWasm, wasm] = await Promise.all([
      import("satori"),
      import("@resvg/resvg-wasm"),
      loadWasm(),
    ]);
    const { initWasm, Resvg } = resvgWasm;

    const memberIcons = await Promise.all(match.partyMembers.map((m) => iconData(m.agentIcon)));
    const memberRankIcons = await Promise.all(
      match.partyMembers.map((m) => iconData(m.rankTier ? tierIcon(m.rankTier, "small") : undefined)),
    );
    const watchedIcon = await iconData(match.agentIcon ?? match.cardIcon);
    const watchedRankIcon = await iconData(match.rankTier ? tierIcon(match.rankTier, "small") : undefined);

    const result = match.won === true ? "VICTORY" : match.won === false ? "DEFEAT" : "RESULT";
    const resultColor = match.won === true ? WIN : match.won === false ? LOSS : "#cbb765";
    const date = match.gameStart
      ? new Date(match.gameStart * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC"
      : "";
    const cardH = CARD_H + match.partyMembers.length * 116;

    const fonts = await loadFonts();
    wasmInitPromise ??= initWasm(await wasm).catch((e) => {
      wasmInitPromise = null;
      throw e;
    });
    await wasmInitPromise;

    const tree = el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          background: BG,
          color: TEXT,
          fontFamily: "Noto Sans JP",
          padding: "36px 44px",
        },
      },
      // Header
      el(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 10 } },
          el("div", { style: { width: 15, height: 15, background: BRAND, borderRadius: 3 } }),
          text("KIWAMERO PARTY WATCH", { fontSize: 20, fontWeight: 700, color: BRAND_LIGHT, letterSpacing: 3 }),
        ),
        text(`${match.mode} · ${match.map}`, { fontSize: 20, color: MUTED }),
      ),
      // Result banner
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 22,
            padding: "14px 24px",
            background: `${resultColor}1f`,
            border: `2px solid ${resultColor}`,
            borderRadius: 14,
          },
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 16 } },
          text(result, { fontSize: 40, fontWeight: 700, color: resultColor }),
          text(match.partyLabel, { fontSize: 20, color: MUTED }),
        ),
        text(match.score, { fontSize: 40, fontWeight: 700, color: TEXT }),
      ),
      // Watched player hero
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginTop: 20,
            background: "#141d3d",
            border: `2px solid ${BRAND}`,
            borderRadius: 18,
            padding: "22px 26px",
          },
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 20 } },
          watchedIcon
            ? el("img", { src: watchedIcon, width: 112, height: 112, style: { borderRadius: 14 } })
            : el("div", { style: { width: 112, height: 112, borderRadius: 14, background: EDGE } }),
          el(
            "div",
            { style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 } },
            text(`${watched.name}#${watched.tag}`, { fontSize: 42, fontWeight: 700, color: BRAND_LIGHT }),
            el(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 10 } },
              text(`${match.agent ?? "?"}`, { fontSize: 21, color: MUTED }),
              watchedRankIcon ? el("img", { src: watchedRankIcon, width: 34, height: 34 }) : null,
            ),
          ),
        ),
        el(
          "div",
          { style: { display: "flex", gap: 12, marginTop: 18 } },
          statCell("K/D/A", `${match.kills}/${match.deaths}/${match.assists}`, TEXT),
          statCell("K/D", kdValue(match.kills, match.deaths), kdColor(match.kills, match.deaths)),
          statCell("ACS", String(match.acs), BRAND_LIGHT),
        ),
      ),
      // Party members
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 20 } },
        text(
          match.partyMembers.length ? `PARTY — ${match.partyLabel}` : "PARTY — SOLO",
          { fontSize: 18, fontWeight: 700, color: MUTED, letterSpacing: 2 },
        ),
        ...(match.partyMembers.length
          ? match.partyMembers.map((m, i) => memberCard(m, memberIcons[i], memberRankIcons[i], BRAND))
          : [el(
              "div",
              {
                style: {
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: `2px dashed ${EDGE}`,
                  borderRadius: 14,
                  padding: "26px 0",
                  color: MUTED,
                  fontSize: 24,
                },
              },
              "Queued solo",
            )]),
      ),
      // Footer
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${EDGE}`,
            paddingTop: 14,
            marginTop: 20,
          },
        },
        text("Kiwamero Tracking", { fontSize: 17, color: BRAND_LIGHT, letterSpacing: 1 }),
        text(date, { fontSize: 17, color: MUTED }),
      ),
    );

    const svg = await satori(tree as never, { width: CARD_W, height: cardH, fonts });
    const png = new Resvg(svg, { background: BG }).render().asPng();
    return new Uint8Array(png);
  } catch (e) {
    console.error("renderWatchCard failed:", e);
    return null;
  }
}
