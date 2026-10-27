export function relTime(gameStartSec: number, baseIso?: string): string {
  const base = baseIso ? new Date(baseIso).getTime() : 0;
  if (!base) return "";
  const diff = Math.max(0, Math.floor(base / 1000 - gameStartSec));
  const h = Math.floor(diff / 3600);
  if (h >= 24 * 30) return `${Math.floor(h / (24 * 30))}mo ago`;
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  return `${Math.max(1, Math.floor(diff / 60))}m ago`;
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function modeLabel(modeId: string): string {
  const map: Record<string, string> = {
    competitive: "Competitive",
    unrated: "Unrated",
    deathmatch: "Deathmatch",
    "team-deathmatch": "Team Deathmatch",
    teamdeathmatch: "Team Deathmatch",
    swiftplay: "Swiftplay",
    premier: "Premier",
    spikerush: "Spike Rush",
    escalation: "Escalation",
    replication: "Replication",
  };
  return map[modeId.toLowerCase()] ?? modeId;
}
