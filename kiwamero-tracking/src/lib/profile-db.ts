import { execute, queryOne } from "./db.ts";

/** BLOBs are ArrayBuffers on D1, Buffers on SQLite. Copy into an owned buffer. */
export async function readDurableProfile(key: string): Promise<ArrayBuffer | null> {
  const row = await queryOne<{ payload: ArrayBuffer | Uint8Array | number[] | null }>(
    "SELECT payload FROM ProfileSnapshot WHERE cacheKey = ? AND capturedAt > invalidatedAt", [key]);
  if (!row?.payload) return null;
  const bytes = row.payload instanceof ArrayBuffer ? new Uint8Array(row.payload) : new Uint8Array(row.payload);
  return bytes.slice().buffer;
}

/** Monotonic writes and invalidation fences stop late responses reviving old data. */
export async function writeDurableProfile(key: string, puuid: string, packed: ArrayBuffer, capturedAt: number) {
  const row = await queryOne(`INSERT INTO ProfileSnapshot(cacheKey, puuid, payload, capturedAt)
    VALUES (?, ?, ?, ?) ON CONFLICT(cacheKey) DO UPDATE SET
      puuid = excluded.puuid, payload = excluded.payload, capturedAt = excluded.capturedAt
    WHERE excluded.capturedAt >= ProfileSnapshot.capturedAt
      AND excluded.capturedAt > ProfileSnapshot.invalidatedAt RETURNING cacheKey`,
    [key, puuid, new Uint8Array(packed), capturedAt]);
  return !!row;
}

export async function invalidateDurableProfile(key: string) {
  await execute(`INSERT INTO ProfileSnapshot(cacheKey, invalidatedAt) VALUES (?, ?)
    ON CONFLICT(cacheKey) DO UPDATE SET payload = NULL,
      invalidatedAt = max(invalidatedAt, excluded.invalidatedAt)`, [key, Date.now()]);
}

export async function claimProfileRefresh(key: string, now = Date.now()) {
  await execute("INSERT OR IGNORE INTO ProfileSnapshot(cacheKey) VALUES (?)", [key]);
  const token = crypto.randomUUID();
  return await queryOne(`UPDATE ProfileSnapshot SET refreshToken = ?, refreshUntil = ?
    WHERE cacheKey = ? AND refreshUntil <= ? AND retryAt <= ? RETURNING cacheKey`,
    [token, now + 120_000, key, now, now]) ? token : null;
}

export async function releaseProfileRefresh(key: string, token: string) {
  await execute(`UPDATE ProfileSnapshot SET refreshToken = NULL, refreshUntil = 0, retryAt = ?
    WHERE cacheKey = ? AND refreshToken = ?`, [Date.now() + 60_000, key, token]);
}
