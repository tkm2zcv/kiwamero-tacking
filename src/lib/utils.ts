import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const TIER_ICON = (tier: number, size: "small" | "large" = "small") =>
  `https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/${tier}/${size}icon.png`;

export const AGENT_ICON = (agent: string) =>
  `/agents/${agent.toLowerCase().replace("/", "-").replace(" ", "")}.webp`;

export const MAP_IMAGE = (map: string) => `/maps/${map.toLowerCase()}.webp`;

export const CARD_ART = (cardId: string, kind: "smallart" | "wideart" | "largeart" = "smallart") =>
  `https://media.valorant-api.com/playercards/${cardId}/${kind}.png`;

export function kdrColor(kdr: number): string {
  if (kdr >= 1.4) return "text-emerald-400";
  if (kdr >= 1.0) return "text-cyan-300";
  if (kdr >= 0.8) return "text-amber-400";
  return "text-red-400";
}

export function relTime(ts: number, now = Date.now()): string {
  const diff = now / 1000 - ts;
  const m = Math.floor(diff / 60);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `about ${h} hours ago`;
  const d = Math.floor(h / 24);
  return `${d} days ago`;
}

export function fmtDate(ts: number): string {
  const d = new Date(ts * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
