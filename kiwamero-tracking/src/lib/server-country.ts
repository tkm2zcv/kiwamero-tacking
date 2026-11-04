import { normalizeCluster } from "./henrik-shared.ts";

// Server location only: not the player's residence or nationality.
const SERVER_CC: Record<string, string> = {
  "Tokyo": "jp", "Hong Kong": "hk", "Singapore": "sg", "Sydney": "au", "Manila": "ph",
  "Mumbai": "in", "Seoul": "kr", "Bahrain": "bh",
  "Oregon": "us", "Portland": "us", "Los Angeles": "us", "Salt Lake City": "us", "Denver": "us",
  "Dallas": "us", "Chicago": "us", "Atlanta": "us", "Ashburn": "us", "Miami": "us",
  "Sao Paulo": "br", "Mexico City": "mx", "Santiago": "cl", "Bogota": "co",
  "Frankfurt": "de", "London": "gb", "Paris": "fr", "Madrid": "es", "Stockholm": "se",
  "Warsaw": "pl", "Istanbul": "tr",
};

export function serverCountryCode(cluster: string): string | undefined {
  const name = normalizeCluster(cluster.trim());
  return Object.hasOwn(SERVER_CC, name) ? SERVER_CC[name] : undefined;
}
