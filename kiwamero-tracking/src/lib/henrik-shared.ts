const TIER_TABLE_UUID = "03621f52-342b-cf4e-4f86-9350a49c6d04";
const TIER_GROUPS = [
  "Unrated", "Iron", "Bronze", "Silver", "Gold",
  "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant",
];

/** Presentation helpers only: safe to import from browser components. */
export function tierIcon(tier: number, size: "small" | "large" = "large") {
  return `https://media.valorant-api.com/competitivetiers/${TIER_TABLE_UUID}/${tier}/${size}icon.png`;
}
export function tierName(tier: number): string {
  if (tier <= 0) return "";
  const group = TIER_GROUPS[Math.floor(tier / 3)] ?? "";
  if (group === "Unrated" || group === "Radiant") return group;
  return group ? `${group} ${(tier % 3) + 1}` : "";
}
export function playerCardArt(cardId: string, variant: "wideart" | "largeart" | "smallart" = "wideart") {
  return `https://media.valorant-api.com/playercards/${cardId}/${variant}.png`;
}
export function normalizeCluster(cluster: string | null | undefined): string {
  return (cluster ?? "").replace(/\s+\d+$/, "");
}
