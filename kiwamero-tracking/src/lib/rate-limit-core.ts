/**
 * Pure fixed-window rate limiting logic. No Next.js imports so it can be
 * unit-tested with `node --test`. Next-facing helpers live in
 * `rate-limit.ts`.
 */

export const RATE_LIMIT_WINDOW_MS = 60_000;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimitPerMinute(): number {
  const n = Number(process.env.API_RATE_LIMIT_PER_MIN);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

export interface RateResult {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit = apiRateLimitPerMinute(),
  windowMs = RATE_LIMIT_WINDOW_MS,
): RateResult {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }
  return {
    ok: bucket.count <= limit,
    limit,
    remaining: Math.max(0, limit - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Test helper: drop all buckets. */
export function resetRateLimitBuckets(): void {
  buckets.clear();
}
