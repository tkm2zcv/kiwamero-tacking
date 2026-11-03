import { HenrikDevError } from "./henrik-errors.ts";
import type { HDStoredMatch } from "./henrik-model";

type HistoryRead = (region: string, puuid: string, options?: {
  mode?: string; size?: number; page?: number;
}) => Promise<HDStoredMatch[]>;

function validate(rows: HDStoredMatch[], puuid: string) {
  if (!Array.isArray(rows) || rows.some((r) => !r?.meta?.id || !Number.isFinite(Date.parse(r.meta.started_at)) ||
    r.stats?.puuid !== puuid)) throw new HenrikDevError(502, "Invalid stored player history");
}

/** Preserve old self statistics even if the provider no longer lists those games. */
export async function incrementalProfileHistory(
  read: HistoryRead, region: string, puuid: string, mode: string | undefined, previous: HDStoredMatch[],
) {
  validate(previous, puuid);
  const params = mode ? { mode } : {};
  const load: HistoryRead = async (...args) => {
    try { return await read(...args); }
    catch (error) { if (error instanceof HenrikDevError && error.status === 404) return []; throw error; }
  };
  let incoming = await load(region, puuid, previous.length ? { ...params, size: 50, page: 1 } : params);
  validate(incoming, puuid);
  const known = new Set(previous.map((r) => r.meta.id));
  // A long absence/newly visible history can move the checkpoint beyond page1.
  // One full stored-list request repairs that gap without a long pagination loop.
  if (previous.length && incoming.length >= 50 && !incoming.some((r) => known.has(r.meta.id))) {
    const full = await load(region, puuid, params);
    validate(full, puuid);
    incoming = [...incoming, ...full];
  }
  return [...new Map([...previous, ...incoming].map((r) => [r.meta.id, r])).values()]
    .sort((a, b) => Date.parse(b.meta.started_at) - Date.parse(a.meta.started_at));
}
