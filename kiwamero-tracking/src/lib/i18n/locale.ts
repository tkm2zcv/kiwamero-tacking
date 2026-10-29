import { defaultLocale, locales, type Locale } from "./dict.ts";

export function resolveLocale(cookie?: string, acceptLanguage?: string | null): Locale {
  if (locales.includes(cookie as Locale)) return cookie as Locale;
  const preferences = (acceptLanguage ?? "").split(",").map((entry, index) => {
    const [range, ...params] = entry.trim().toLowerCase().split(";");
    const quality = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    return { language: range.split("-")[0], q: quality ? Number(quality.slice(2)) : 1, index };
  }).filter((p) => Number.isFinite(p.q) && p.q > 0 && p.q <= 1)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  const match = preferences.find((p) => locales.includes(p.language as Locale));
  return match ? match.language as Locale : defaultLocale;
}
