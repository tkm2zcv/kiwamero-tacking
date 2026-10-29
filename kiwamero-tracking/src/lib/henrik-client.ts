/**
 * Low-level HenrikDev HTTP layer: response caching, in-flight dedupe, and
 * API-key rotation. No Next.js imports so it can be unit-tested with
 * `node --test`. Endpoint wrappers live in `henrikdev.ts`.
 *
 * Caching is an in-process Map — in workerd it is per-isolate (best-effort),
 * which is enough for the single-operator scale of this site. It removes the
 * repeated upstream calls that tab switches and page re-renders would cause;
 * `getMatches`/`getStoredMatches` payloads exceed Next's 2MB data-cache limit
 * and previously ran `no-store` on every render.
 */

const BASE = "https://api.henrikdev.xyz";
const KEY_COOLDOWN_MS = 60_000;
const MAX_CACHE_ENTRIES = 200;

export class HenrikDevError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HenrikDevError";
    this.status = status;
  }
}

// --- API keys -----------------------------------------------------------

const keyCooldownUntil = new Map<string, number>();
let keyCursor = 0;

/** `HENRIK_API_KEYS` (comma-separated) plus legacy single `HENRIK_API_KEY`. */
export function apiKeys(): string[] {
  const keys = new Set(
    (process.env.HENRIK_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
  const single = process.env.HENRIK_API_KEY?.trim();
  if (single) keys.add(single);
  return [...keys];
}

/** Next usable key, round-robin across keys not in a 429 cooldown. */
export function pickKey(now = Date.now()): string | undefined {
  const keys = apiKeys();
  if (!keys.length) return undefined;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(keyCursor + i) % keys.length];
    if ((keyCooldownUntil.get(k) ?? 0) <= now) {
      keyCursor = (keyCursor + i + 1) % keys.length;
      return k;
    }
  }
  return keys[0]; // all cooling down — use the first anyway
}

export function markKeyCooldown(key: string, untilMs: number): void {
  keyCooldownUntil.set(key, untilMs);
}

// --- Response cache -----------------------------------------------------

// Layer 1: in-process Map (Node dev, per-isolate in workerd).
// Layer 2: Cloudflare Cache API — shared across isolates in the same colo,
// so most requests never reach the upstream API even on cold isolates.
const cache = new Map<string, { at: number; ttl: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

interface EdgeBody {
  exp: number;
  data: unknown;
}

function edgeCache(): Cache | undefined {
  try {
    return (globalThis as { caches?: { default?: Cache } }).caches?.default;
  } catch {
    return undefined;
  }
}

function edgeKey(path: string): Request {
  return new Request(`https://henrik-cache.internal${path}`);
}

async function readEdgeCache(path: string): Promise<EdgeBody | undefined> {
  const c = edgeCache();
  if (!c) return undefined;
  try {
    const res = await c.match(edgeKey(path));
    if (!res) return undefined;
    const body = (await res.json()) as EdgeBody;
    return body.exp > Date.now() ? body : undefined;
  } catch {
    return undefined;
  }
}

async function writeEdgeCache(path: string, data: unknown, ttl: number): Promise<void> {
  const c = edgeCache();
  if (!c) return;
  try {
    const body: EdgeBody = { exp: Date.now() + ttl, data };
    await c.put(
      edgeKey(path),
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json" },
      }),
    );
  } catch {
    // Edge cache is best-effort; the in-process Map still serves repeats.
  }
}

function readCache(key: string): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.at + hit.ttl <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.data;
}

function writeCache(key: string, data: unknown, ttl: number): void {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.at + v.ttl <= now) cache.delete(k);
    if (cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
  }
  cache.set(key, { at: Date.now(), ttl, data });
}

/** Test helper. */
export function resetHenrikClient(): void {
  cache.clear();
  inflight.clear();
  keyCooldownUntil.clear();
  keyCursor = 0;
}

// --- Core call ----------------------------------------------------------

export interface HenrikCallOptions {
  /** Cache TTL in ms. 0 disables caching. */
  ttl?: number;
  /** Bypass the cache (still participates in in-flight dedupe writes). */
  fresh?: boolean;
  headers?: Record<string, string>;
}

interface ApiResponse<T> {
  status: number;
  data: T;
  errors?: { message: string }[];
}

async function fetchOnce<T>(path: string, init?: HenrikCallOptions): Promise<T> {
  const keys = apiKeys();
  const maxAttempts = Math.max(1, Math.min(keys.length || 1, 3));
  let res: Response | undefined;
  for (let i = 0; i < maxAttempts; i++) {
    const key = pickKey();
    res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(key ? { Authorization: key } : {}),
        ...(init?.headers ?? {}),
      },
    });
    if (res.status !== 429) break;
    if (key) {
      const retryAfter = Number(res.headers.get("retry-after"));
      markKeyCooldown(
        key,
        Date.now() + (Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : KEY_COOLDOWN_MS),
      );
    }
  }
  const json = (await res!.json()) as ApiResponse<T>;
  if (json.status !== 200) {
    throw new HenrikDevError(
      json.status ?? res!.status,
      `henrikdev ${path} -> ${json.status}: ${json.errors?.[0]?.message ?? res!.statusText}`,
    );
  }
  return json.data;
}

export function henrikCall<T>(path: string, opts?: HenrikCallOptions): Promise<T> {
  const ttl = opts?.ttl ?? 60_000;
  const pending = inflight.get(path);
  if (pending) return pending as Promise<T>;
  const p = lookup<T>(path, opts, ttl).finally(() => inflight.delete(path));
  inflight.set(path, p);
  return p;
}

async function lookup<T>(path: string, opts: HenrikCallOptions | undefined, ttl: number): Promise<T> {
  if (!opts?.fresh && ttl > 0) {
    const hit = readCache(path) as T | undefined;
    if (hit !== undefined) return hit;
    const edge = await readEdgeCache(path);
    if (edge !== undefined) {
      writeCache(path, edge.data, Math.min(ttl, edge.exp - Date.now()));
      return edge.data as T;
    }
  }
  const data = await fetchOnce<T>(path, opts);
  if (ttl > 0) {
    writeCache(path, data, ttl);
    await writeEdgeCache(path, data, ttl);
  }
  return data;
}
