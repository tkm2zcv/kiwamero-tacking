import { HenrikDevError } from "./henrik-errors.ts";
import { coolQuota, reserveQuota, retryAfterMs, type HenrikPriority } from "./henrik-quota.ts";

export async function requestHenrik<T>(
  path: string,
  keys: string[],
  options: { priority?: HenrikPriority; headers?: Record<string, string> },
  onCooldown: (key: string, until: number) => void,
): Promise<T> {
  if (!keys.length) throw new HenrikDevError(503, "HenrikDev is not configured");
  let retryAt = Infinity;
  // A key is attempted at most once; a cooling/exhausted key never gets forced.
  for (const key of keys) {
    if (key) {
      const slot = await reserveQuota(key, options.priority ?? "interactive");
      if (!slot.ok) { retryAt = Math.min(retryAt, slot.retryAt); continue; }
    }
    let response: Response;
    try {
      response = await fetch(`https://api.henrikdev.xyz${path}`, {
        cache: "no-store", signal: AbortSignal.timeout(15_000),
        headers: { Accept: "application/json", ...options.headers, ...(key ? { Authorization: key } : {}) },
      });
    } catch {
      throw new HenrikDevError(503, "HenrikDev transport unavailable");
    }
    if ((response.status === 429 || response.status === 401) && key) {
      const until = Date.now() + (response.status === 401
        ? 300_000 : retryAfterMs(response.headers.get("retry-after")));
      await coolQuota(key, until);
      onCooldown(key, until);
      retryAt = Math.min(retryAt, until);
      await response.body?.cancel();
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new HenrikDevError(response.status, `HenrikDev request failed (${response.status})`);
    }
    let json: { status?: number; data?: T };
    try { json = await response.json(); }
    catch { throw new HenrikDevError(502, "Invalid HenrikDev response"); }
    if (!json || typeof json !== "object") throw new HenrikDevError(502, "Invalid HenrikDev response");
    if (json.status !== 200 || json.data == null) {
      const status = Number.isInteger(json.status) && json.status! >= 400 && json.status! <= 599 ? json.status! : 502;
      throw new HenrikDevError(status, "Invalid HenrikDev response");
    }
    return json.data;
  }
  throw new HenrikDevError(429, "HenrikDev quota temporarily exhausted",
    Number.isFinite(retryAt) ? Math.max(1, Math.ceil((retryAt - Date.now()) / 1000)) : 60);
}
