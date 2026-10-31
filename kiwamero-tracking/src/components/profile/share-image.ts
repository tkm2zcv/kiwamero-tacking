import type { ShareCardModel } from "@/lib/share-card-data";

const WIDTH = 1400;
const HEIGHT = 700;
const FONT = 'Saira, Roboto, "Segoe UI", "Noto Sans JP", sans-serif';
const COLORS = {
  bg: "#101923",
  bgDeep: "#0b1119",
  box: "#2b3846",
  boxBorder: "rgba(148, 184, 206, 0.18)",
  brand: "#0155fd",
  brandText: "#3a86ff",
  brandSoft: "rgba(1, 85, 253, 0.32)",
  text: "#eef8ff",
  muted: "#9fb3c3",
};

function proxiedImage(src?: string) {
  if (!src) return "";
  if (src.startsWith("/") || src.startsWith("data:") || src.startsWith("blob:")) return src;
  return `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;
}

function loadImage(src?: string): Promise<HTMLImageElement | null> {
  const url = proxiedImage(src);
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = window.setTimeout(() => resolve(null), 7000);
    const done = (value: HTMLImageElement | null) => {
      window.clearTimeout(timer);
      resolve(value);
    };
    img.decoding = "async";
    img.onload = () => done(img);
    img.onerror = () => done(null);
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, startSize: number, weight = 600) {
  let size = startSize;
  while (size > 18) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 3;
  }
  return size;
}

function centeredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  size: number,
  color = COLORS.brandText,
  weight = 500,
) {
  fitFont(ctx, text, maxWidth, size, weight);
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, x + maxWidth / 2, y);
  ctx.textAlign = "left";
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawStat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: string, label: string) {
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = COLORS.box;
  ctx.fill();
  ctx.strokeStyle = COLORS.boxBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  centeredText(ctx, value, x, y + 48, w, 42, COLORS.brandText, 500);
  centeredText(ctx, label, x, y + 88, w, 34, COLORS.brandText, 400);
}

function drawServerIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = COLORS.brandText;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (const [yy, inset] of [[0, 0], [13, 8], [26, 0]] as const) {
    ctx.beginPath();
    ctx.moveTo(x + inset, y + yy);
    ctx.lineTo(x + 48 - inset, y + yy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + inset + 5, y + yy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.brandText;
    ctx.fill();
  }
}

function drawFallbackAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, "#253a52");
  gradient.addColorStop(1, "#172433");
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = "rgba(1, 85, 253, 0.22)";
  ctx.font = `700 ${Math.round(size / 2.4)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("K", x + size / 2, y + size / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

export function shareCardFileName(card: ShareCardModel) {
  const base = `${card.name}-${card.tag}`.replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-+|-+$/g, "");
  return `${base || "valorant-player"}-stats.png`;
}

export async function renderShareCardImage(card: ShareCardModel): Promise<Blob> {
  await document.fonts?.ready.catch(() => undefined);
  const [avatar, rankIcon, logo] = await Promise.all([
    loadImage(card.avatarUrl),
    loadImage(card.rankIconUrl),
    loadImage("/brand/logo.webp"),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, COLORS.bg);
  bg.addColorStop(1, COLORS.bgDeep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glow = ctx.createRadialGradient(1190, 90, 20, 1190, 90, 520);
  glow.addColorStop(0, "rgba(1, 85, 253, 0.24)");
  glow.addColorStop(1, "rgba(1, 85, 253, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = COLORS.brandSoft;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, WIDTH - 40, HEIGHT - 40);

  const fullName = `${card.name}#${card.tag}`;
  fitFont(ctx, fullName, 900, 66, 500);
  ctx.fillStyle = COLORS.brandText;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(fullName, 50, 105);

  const avatarBox = { x: 50, y: 145, size: 180 };
  if (avatar) drawImageCover(ctx, avatar, avatarBox.x, avatarBox.y, avatarBox.size, avatarBox.size);
  else drawFallbackAvatar(ctx, avatarBox.x, avatarBox.y, avatarBox.size);
  ctx.strokeStyle = COLORS.brand;
  ctx.lineWidth = 4;
  ctx.strokeRect(avatarBox.x, avatarBox.y, avatarBox.size, avatarBox.size);

  ctx.fillStyle = COLORS.brandText;
  ctx.font = `400 48px ${FONT}`;
  ctx.fillText(`lvl ${card.level || "—"}`, avatarBox.x, 385);
  ctx.font = `400 42px ${FONT}`;
  ctx.fillText(card.region || "—", avatarBox.x, 440);

  const gridX = 290;
  const statW = 185;
  const statH = 105;
  const gap = 18;
  const noStats = card.matchesAvailable <= 0;
  const topStats = [
    { value: noStats ? "—" : card.stats.kd.toFixed(2), label: "K/D" },
    { value: noStats ? "—" : card.stats.hs.toFixed(2), label: "HS%" },
    { value: noStats ? "—" : card.stats.adr.toFixed(2), label: "ADR" },
    { value: noStats ? "—" : card.stats.acs.toFixed(2), label: "ACS" },
  ];
  const bottomStats = [
    { value: noStats ? "—" : card.stats.winRate.toFixed(2), label: "Win %" },
    { value: card.stats.matches.toLocaleString("en-US"), label: "Matches" },
    { value: card.stats.wins.toLocaleString("en-US"), label: "Wins" },
    { value: card.stats.losses.toLocaleString("en-US"), label: "Losses" },
  ];
  topStats.forEach((stat, i) => drawStat(ctx, gridX + i * (statW + gap), 145, statW, statH, stat.value, stat.label));
  bottomStats.forEach((stat, i) => drawStat(ctx, gridX + i * (statW + gap), 270, statW, statH, stat.value, stat.label));

  const rankX = 1150;
  if (rankIcon) {
    const size = 215;
    const scale = Math.min(size / rankIcon.naturalWidth, size / rankIcon.naturalHeight);
    const w = rankIcon.naturalWidth * scale;
    const h = rankIcon.naturalHeight * scale;
    ctx.drawImage(rankIcon, rankX + (size - w) / 2, 120 + (size - h) / 2, w, h);
  }
  centeredText(ctx, card.rankName || "Unranked", rankX - 40, 405, 290, 46, COLORS.brandText, 500);
  centeredText(ctx, Number.isFinite(card.rr) ? `${card.rr.toLocaleString("en-US")}RR` : "—", rankX - 40, 465, 290, 42, COLORS.brandText, 500);

  ctx.strokeStyle = "rgba(148, 184, 206, 0.16)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 525);
  ctx.lineTo(1350, 525);
  ctx.stroke();

  drawServerIcon(ctx, 290, 552);
  ctx.fillStyle = COLORS.brandText;
  ctx.font = `400 46px ${FONT}`;
  ctx.fillText(card.server || "—", 360, 590);

  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(`${card.actLabel} · ${card.playlistLabel}`, 50, 648);
  ctx.fillStyle = COLORS.brandText;
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText(noStats ? "No recorded matches in this scope" : `${card.matchesAvailable.toLocaleString("en-US")} recorded matches`, 50, 618);

  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.brandText;
  ctx.font = `500 48px ${FONT}`;
  ctx.fillText("Kiwamero Tracking", 1290, 630);
  ctx.textAlign = "left";
  if (logo) ctx.drawImage(logo, 1305, 588, 55, 55);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not encode PNG")), "image/png");
  });
}
