/** tracker.gg profile URL for a Riot ID — the "official" view a search prefers. */
export function trackerProfileUrl(name: string, tag: string): string {
  return `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(name)}%23${encodeURIComponent(tag)}/overview`;
}
