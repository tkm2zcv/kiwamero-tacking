import type { AuditCountry } from "./report-model";

/** Optional seller-listed country context for the audit. */
export const AUDIT_COUNTRIES: AuditCountry[] = [
  { code: "Ind", iso2: "in", nameJa: "インド", nameEn: "India", emoji: "🇮🇳", nativeServer: "Mumbai", regionCategory: "south_asia", regionCategoryJa: "南アジア", pingEstimateToTokyo: 140, sampleCountInApi: 42 },
  { code: "Phl", iso2: "ph", nameJa: "フィリピン", nameEn: "Philippines", emoji: "🇵🇭", nativeServer: "Manila", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 85, sampleCountInApi: 30 },
  { code: "Idn", iso2: "id", nameJa: "インドネシア", nameEn: "Indonesia", emoji: "🇮🇩", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 90, sampleCountInApi: 24 },
  { code: "Vnm", iso2: "vn", nameJa: "ベトナム", nameEn: "Vietnam", emoji: "🇻🇳", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 80, sampleCountInApi: 23 },
  { code: "Tha", iso2: "th", nameJa: "タイ", nameEn: "Thailand", emoji: "🇹🇭", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 85, sampleCountInApi: 15 },
  { code: "Jpn", iso2: "jp", nameJa: "日本", nameEn: "Japan", emoji: "🇯🇵", nativeServer: "Tokyo", regionCategory: "domestic", regionCategoryJa: "日本国内", pingEstimateToTokyo: 15, sampleCountInApi: 7 },
  { code: "Mys", iso2: "my", nameJa: "マレーシア", nameEn: "Malaysia", emoji: "🇲🇾", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 80, sampleCountInApi: 5 },
  { code: "Aus", iso2: "au", nameJa: "オーストラリア", nameEn: "Australia", emoji: "🇦🇺", nativeServer: "Sydney", regionCategory: "oceania", regionCategoryJa: "オセアニア", pingEstimateToTokyo: 140, sampleCountInApi: 4 },
  { code: "Twn", iso2: "tw", nameJa: "台湾", nameEn: "Taiwan", emoji: "🇹🇼", nativeServer: "Hong Kong", regionCategory: "east_asia", regionCategoryJa: "東アジア", pingEstimateToTokyo: 45, sampleCountInApi: 2 },
  { code: "Npl", iso2: "np", nameJa: "ネパール", nameEn: "Nepal", emoji: "🇳🇵", nativeServer: "Mumbai", regionCategory: "south_asia", regionCategoryJa: "南アジア", pingEstimateToTokyo: 150, sampleCountInApi: 2 },
  { code: "Nzl", iso2: "nz", nameJa: "ニュージーランド", nameEn: "New Zealand", emoji: "🇳🇿", nativeServer: "Sydney", regionCategory: "oceania", regionCategoryJa: "オセアニア", pingEstimateToTokyo: 155, sampleCountInApi: 1 },
  { code: "Mmr", iso2: "mm", nameJa: "ミャンマー", nameEn: "Myanmar", emoji: "🇲🇲", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 90, sampleCountInApi: 1 },
  { code: "Hkg", iso2: "hk", nameJa: "香港", nameEn: "Hong Kong", emoji: "🇭🇰", nativeServer: "Hong Kong", regionCategory: "east_asia", regionCategoryJa: "東アジア", pingEstimateToTokyo: 45, sampleCountInApi: 1 },
  { code: "Brn", iso2: "bn", nameJa: "ブルネイ", nameEn: "Brunei", emoji: "🇧🇳", nativeServer: "Singapore", regionCategory: "southeast_asia", regionCategoryJa: "東南アジア", pingEstimateToTokyo: 85, sampleCountInApi: 1 },
  { code: "Bgd", iso2: "bd", nameJa: "バングラデシュ", nameEn: "Bangladesh", emoji: "🇧🇩", nativeServer: "Mumbai", regionCategory: "south_asia", regionCategoryJa: "南アジア", pingEstimateToTokyo: 140, sampleCountInApi: 1 },
];

export function auditCountryByCode(code?: string | null): AuditCountry | null {
  if (!code) return null;
  const key = code.toLowerCase();
  return AUDIT_COUNTRIES.find((country) => country.code.toLowerCase() === key) ?? null;
}
