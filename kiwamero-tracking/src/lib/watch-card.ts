/**
 * Server-side match card renderer for Discord watch notifications.
 * satori (element tree -> SVG) + @resvg/resvg-wasm (SVG -> PNG).
 * Workers use statically imported WASM modules; Node reads installed binaries.
 * Pin Satori 0.32.0: newer builds eagerly initialize Worker-incompatible HarfBuzz.
 */

import type { NewMatchSummary } from "./watch-core";

// Same tier table as henrik-shared.ts (kept inline so this module stays
// self-contained for both the Next bundle and direct Node execution).
const TIER_TABLE_UUID = "03621f52-342b-cf4e-4f86-9350a49c6d04";
const tierIcon = (tier: number, size: "small" | "large" = "small") =>
  `https://media.valorant-api.com/competitivetiers/${TIER_TABLE_UUID}/${tier}/${size}icon.png`;

const CARD_W = 880;
const BASE_H = 720;
const MEMBER_H = 112;
const MEMBER_GAP = 12;

const BRAND = "#2f8cff";
const BRAND_LIGHT = "#5ab0ff";
const CYAN = "#42b8ff";
const BG = "#061020";
const PANEL = "#0d1830";
const PANEL_2 = "#10203d";
const EDGE = "#203451";
const TEXT = "#f4f8ff";
const MUTED = "#8ea0c4";
const WIN = "#17e5b3";
const LOSS = "#ef4f68";

type El = { type: string; props: Record<string, unknown> };
const el = (type: string, props: Record<string, unknown>, ...children: unknown[]): El => ({
  type,
  props: { ...props, children: children.length <= 1 ? children[0] : children },
});
const text = (value: string, style: Record<string, unknown>): El =>
  el("div", { style }, value);

type WatchWasm = { resvg: BufferSource | WebAssembly.Module; layout: BufferSource | WebAssembly.Module };
let wasmPromise: Promise<WatchWasm> | null = null;
let wasmInitPromise: Promise<unknown> | null = null;
let layoutInitPromise: Promise<void> | null = null;
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
// Full Noto JP TTFs are about 5.7 MB each, not the smaller browser subsets.
const MAX_FONT_BYTES = 8 * 1024 * 1024;
const MAX_FONT_CSS_BYTES = 16 * 1024;

async function loadWasm(): Promise<WatchWasm> {
  const compiled = (globalThis as typeof globalThis & {
    __kiwameroWatchWasm?: WatchWasm;
  }).__kiwameroWatchWasm;
  if (compiled) return compiled;
  wasmPromise ??= (async () => {
    const fs = await import("node:fs/promises");
    const [resvg, layout] = await Promise.all([
      fs.readFile(`${process.cwd()}/node_modules/@resvg/resvg-wasm/index_bg.wasm`),
      fs.readFile(`${process.cwd()}/node_modules/satori/yoga.wasm`),
    ]);
    return { resvg, layout };
  })().catch((error) => {
    wasmPromise = null;
    throw error;
  });
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
        const r = await fetch(u, { redirect: "manual" });
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
    const cssResponse = await fetch(
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700",
      { headers: { "user-agent": "Mozilla/4.0" }, redirect: "manual" },
    );
    if (!cssResponse.ok) throw new Error(`font CSS fetch ${cssResponse.status}`);
    if (Number(cssResponse.headers.get("content-length")) > MAX_FONT_CSS_BYTES) throw new Error("font CSS too large");
    const cssBytes = await cssResponse.arrayBuffer();
    if (cssBytes.byteLength > MAX_FONT_CSS_BYTES) throw new Error("font CSS too large");
    const css = new TextDecoder().decode(cssBytes);
    const blocks = css.split("@font-face").slice(1);
    // The fixed legacy UA requests exactly the two full fonts, not unicode subsets.
    if (!blocks.length || blocks.length > 2) throw new Error(`unexpected font count: ${blocks.length}`);
    return Promise.all(
      blocks.map(async (block) => {
        const weight = (Number(block.match(/font-weight:\s*(\d+)/)?.[1] ?? 400) === 700 ? 700 : 400) as 400 | 700;
        const url = block.match(/url\((https:[^)]+)\)/)?.[1];
        if (!url) throw new Error("font url missing");
        const u = new URL(url);
        if (u.protocol !== "https:" || u.hostname !== "fonts.gstatic.com") {
          throw new Error("font url rejected");
        }
        const res = await fetch(u, { redirect: "manual" });
        if (!res.ok) throw new Error(`font fetch ${res.status}`);
        if (Number(res.headers.get("content-length")) > MAX_FONT_BYTES) throw new Error("font too large");
        const data = await res.arrayBuffer();
        if (data.byteLength > MAX_FONT_BYTES) throw new Error("font too large");
        return { name: "Noto Sans JP", data, weight, style: "normal" as const };
      }),
    );
  })().catch((error) => {
    fontPromise = null;
    throw new Error("fonts unavailable", { cause: error });
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

function iconBox(symbol: string, size: number, color: string, background = `${color}1f`): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.max(8, size / 3),
        background,
        border: `1px solid ${color}55`,
        color,
        fontSize: Math.round(size * 0.48),
        fontWeight: 700,
        flexShrink: 0,
      },
    },
    symbol,
  );
}

function brandLogo(size: number): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        background: BRAND,
        color: "#ffffff",
        fontSize: Math.round(size * 0.56),
        fontWeight: 700,
        flexShrink: 0,
      },
    },
    "K",
  );
}

function metaChip(symbol: string, label: string): El {
  return el(
    "div",
    { style: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 } },
    iconBox(symbol, 30, BRAND_LIGHT, "#12264f"),
    text(label, {
      fontSize: 22,
      fontWeight: 700,
      color: TEXT,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 250,
    }),
  );
}

function statCell(icon: string, label: string, value: string, color: string): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        flex: 1,
        minWidth: 0,
        background: "#0b1834",
        border: `1px solid ${EDGE}`,
        borderRadius: 15,
        padding: "16px 10px",
      },
    },
    el(
      "div",
      { style: { display: "flex", alignItems: "center", gap: 8, color: MUTED } },
      iconBox(icon, 24, BRAND_LIGHT, "#12264f"),
      text(label, { fontSize: 15, fontWeight: 700, color: MUTED, letterSpacing: 1.6 }),
    ),
    text(value, { fontSize: 37, fontWeight: 700, color, lineHeight: 1 }),
  );
}

function agentChip(agent: string | undefined, rankIcon: string | null): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#18264d",
        border: `1px solid ${EDGE}`,
        borderRadius: 12,
        padding: "7px 12px",
        flexShrink: 0,
      },
    },
    text("◆", { fontSize: 12, color: BRAND_LIGHT, lineHeight: 1 }),
    text(agent ?? "?", { fontSize: 18, fontWeight: 700, color: TEXT, whiteSpace: "nowrap" }),
    rankIcon ? el("img", { src: rankIcon, width: 25, height: 25 }) : null,
  );
}

function infoPill(value: string, color: string): El {
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        background: `${color}18`,
        border: `1px solid ${color}44`,
        borderRadius: 9,
        padding: "5px 9px",
        flexShrink: 0,
      },
    },
    text(value, { fontSize: 15, fontWeight: 700, color, whiteSpace: "nowrap" }),
  );
}

function memberCard(
  member: { name: string; tag: string; agent?: string; rankTier?: number; kills: number; deaths: number; assists: number; season?: { kills: number; deaths: number; matches: number } | null; encountersAct?: number; encountersAll?: number },
  icon: string | null,
  rankIcon: string | null,
  partyColor: string,
): El {
  const seasonKd = member.season ? `szn K/D ${kdValue(member.season.kills, member.season.deaths)}` : null;
  const met = member.encountersAll != null ? `met ${member.encountersAct ?? 0}/${member.encountersAll}` : null;
  return el(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 18,
        background: PANEL_2,
        border: `1px solid ${EDGE}`,
        borderLeft: `7px solid ${partyColor}`,
        borderRadius: 17,
        padding: "16px 20px",
        height: 108,
        boxSizing: "border-box",
      },
    },
    icon
      ? el("img", { src: icon, width: 76, height: 76, style: { borderRadius: 14 } })
      : el("div", { style: { width: 76, height: 76, borderRadius: 14, background: EDGE } }),
    el(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 0 } },
      el(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: 5, minWidth: 0 } },
        text(member.name, {
          fontSize: 29, fontWeight: 700, color: TEXT,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 330,
        }),
        text(`#${member.tag}`, { fontSize: 22, fontWeight: 700, color: BRAND_LIGHT, flexShrink: 0 }),
      ),
      el(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "nowrap", overflow: "hidden" } },
        agentChip(member.agent, rankIcon),
        seasonKd ? infoPill(seasonKd, BRAND_LIGHT) : null,
        met ? infoPill(met, MUTED) : null,
      ),
    ),
    el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "center",
          minWidth: 142,
          paddingLeft: 18,
          borderLeft: `2px solid ${EDGE}`,
          flexShrink: 0,
        },
      },
      text(`${member.kills}/${member.deaths}/${member.assists}`, { fontSize: 30, fontWeight: 700, color: TEXT, lineHeight: 1 }),
      text(`K/D ${kdValue(member.kills, member.deaths)}`, {
        fontSize: 17,
        fontWeight: 700,
        color: kdColor(member.kills, member.deaths),
        marginTop: 5,
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
    const [{ default: satori, init: initLayout }, resvgWasm, wasm] = await Promise.all([
      import("satori/standalone"),
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
    const resultBg =
      match.won === true
        ? "linear-gradient(90deg, #087955 0%, #0ccf9f 58%, #07875f 100%)"
        : match.won === false
          ? "linear-gradient(90deg, #8f1f3d 0%, #d63d59 58%, #8f2440 100%)"
          : "linear-gradient(90deg, #423b22 0%, #716127 58%, #423b22 100%)";
    const resultIcon = match.won === true ? "★" : match.won === false ? "×" : "◆";
    const date = match.gameStart
      ? new Date(match.gameStart * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC"
      : "";
    const partyRowsH = match.partyMembers.length
      ? match.partyMembers.length * MEMBER_H + (match.partyMembers.length - 1) * MEMBER_GAP
      : 92;
    const cardH = BASE_H + partyRowsH;

    const fonts = await loadFonts();
    layoutInitPromise ??= initLayout(wasm.layout).catch((e) => {
      layoutInitPromise = null;
      throw e;
    });
    wasmInitPromise ??= initWasm(wasm.resvg).catch((e) => {
      wasmInitPromise = null;
      throw e;
    });
    await Promise.all([layoutInitPromise, wasmInitPromise]);

    const tree = el(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          width: CARD_W,
          height: cardH,
          boxSizing: "border-box",
          background: BG,
          color: TEXT,
          fontFamily: "Noto Sans JP",
          padding: "26px 30px 24px",
        },
      },
      el(
        "div",
        { style: { display: "flex", alignItems: "center", height: 52 } },
        brandLogo(46),
        el("div", { style: { width: 1, height: 38, background: EDGE, margin: "0 16px" } }),
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", justifyContent: "center" } },
          el(
            "div",
            { style: { display: "flex", alignItems: "baseline", gap: 8 } },
            text("KIWAMERO", { fontSize: 25, fontWeight: 700, color: TEXT, letterSpacing: 1 }),
            text("PARTY WATCH", { fontSize: 25, fontWeight: 700, color: CYAN, letterSpacing: 1 }),
          ),
          text(`${match.partyLabel} MATCH ALERT`, { fontSize: 13, color: MUTED, letterSpacing: 2.2, marginTop: 2 }),
        ),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            height: 58,
            marginTop: 16,
            background: PANEL,
            border: `1px solid ${EDGE}`,
            borderRadius: 14,
          },
        },
        el("div", { style: { display: "flex", flex: 1, paddingLeft: 20, minWidth: 0 } }, metaChip("▦", match.mode)),
        el("div", { style: { width: 1, height: 34, background: EDGE, flexShrink: 0 } }),
        el("div", { style: { display: "flex", flex: 1, paddingLeft: 20, minWidth: 0 } }, metaChip("◇", match.map)),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: 92,
            marginTop: 18,
            padding: "0 26px",
            background: resultBg,
            borderRadius: 18,
          },
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 16 } },
          iconBox(resultIcon, 46, "#ffffff", "#ffffff20"),
          text(result, { fontSize: 44, fontWeight: 700, color: "#ffffff", letterSpacing: 0.8, lineHeight: 1 }),
        ),
        text(match.score, { fontSize: 42, fontWeight: 700, color: "#ffffff", lineHeight: 1 }),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            marginTop: 18,
            background: PANEL,
            border: `2px solid ${EDGE}`,
            borderRadius: 20,
            padding: "22px 24px",
          },
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 22 } },
          watchedIcon
            ? el("img", { src: watchedIcon, width: 112, height: 112, style: { borderRadius: 18 } })
            : el("div", { style: { width: 112, height: 112, borderRadius: 18, background: EDGE } }),
          el(
            "div",
            { style: { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 } },
            el(
              "div",
              { style: { display: "flex", alignItems: "baseline", gap: 6, minWidth: 0 } },
              text(watched.name, {
                fontSize: 42, fontWeight: 700, color: TEXT,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 430,
              }),
              text(`#${watched.tag}`, { fontSize: 30, fontWeight: 700, color: BRAND_LIGHT, flexShrink: 0 }),
            ),
            el(
              "div",
              { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 10 } },
              agentChip(match.agent, watchedRankIcon),
              infoPill("WATCHED PLAYER", CYAN),
            ),
          ),
        ),
        el(
          "div",
          { style: { display: "flex", gap: 12, marginTop: 18 } },
          statCell("▥", "K/D/A", `${match.kills}/${match.deaths}/${match.assists}`, TEXT),
          statCell("◆", "K/D", kdValue(match.kills, match.deaths), kdColor(match.kills, match.deaths)),
          statCell("≡", "ACS", String(match.acs), BRAND_LIGHT),
        ),
      ),
      el(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 12, marginTop: 18 } },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 10 } },
          iconBox("◉", 30, BRAND_LIGHT, "#12264f"),
          text(
            match.partyMembers.length ? `PARTY — ${match.partyLabel}` : "PARTY — SOLO",
            { fontSize: 18, fontWeight: 700, color: MUTED, letterSpacing: 2 },
          ),
        ),
        el(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: MEMBER_GAP } },
          ...(match.partyMembers.length
            ? match.partyMembers.map((m, i) => memberCard(m, memberIcons[i], memberRankIcons[i], BRAND_LIGHT))
            : [el(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    border: `2px dashed ${EDGE}`,
                    borderRadius: 16,
                    height: 90,
                    color: MUTED,
                  },
                },
                iconBox("◉", 28, MUTED, "#101b35"),
                text("Queued solo", { fontSize: 24, fontWeight: 700, color: MUTED }),
              )]),
        ),
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderTop: `1px solid ${EDGE}`,
            paddingTop: 14,
            marginTop: 18,
          },
        },
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 10 } },
          brandLogo(28),
          text("Kiwamero Tracking", { fontSize: 18, fontWeight: 700, color: BRAND_LIGHT, letterSpacing: 0.8 }),
        ),
        el(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8 } },
          iconBox("◉", 24, MUTED, "#101b35"),
          text(date, { fontSize: 16, color: MUTED }),
        ),
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
