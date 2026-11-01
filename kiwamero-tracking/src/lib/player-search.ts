export type PlayerSearch =
  | { kind: "riot"; name: string; tag: string }
  | { kind: "puuid"; puuid: string };

export function isPuuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function parsePlayerSearch(value: string): PlayerSearch | null {
  const text = value.trim();
  if (isPuuid(text)) return { kind: "puuid", puuid: text.toLowerCase() };
  const match = text.match(/^(.+?)#(.+)$/);
  return match ? { kind: "riot", name: match[1], tag: match[2] } : null;
}

export function playerProfilePath(player: PlayerSearch): string {
  const id = player.kind === "puuid" ? player.puuid : `${player.name}#${player.tag}`;
  return `/valorant/profile/riot/${encodeURIComponent(id)}`;
}
