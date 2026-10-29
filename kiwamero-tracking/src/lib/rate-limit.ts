import { NextResponse } from "next/server";
import "server-only";

/**
 * Fixed-window rate limiter for the owner-only developer API (R-10).
 *
 * The bucket map lives in module scope, so on Cloudflare Workers it is
 * per-isolate — a best-effort cap, not a global guarantee. Durable enforcement
 * should also be configured as a Cloudflare rate-limiting rule (see
 * docs/deployment-guide.md).
 */
export {
  apiRateLimitPerMinute,
  checkRateLimit,
  type RateResult,
} from "./rate-limit-core.ts";
import type { RateResult } from "./rate-limit-core.ts";

export function rateLimitResponse(result: RateResult): NextResponse {
  const retryAfter = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
  return NextResponse.json(
    { error: "rate_limited", retryAfter },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
