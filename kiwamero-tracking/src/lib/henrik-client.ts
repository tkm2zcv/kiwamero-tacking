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

import { requestHenrik } from "./henrik-request.ts";
import { beforeDeadline, deadlineAfter } from "./deadline.ts";
import type { HenrikPriority } from "./henrik-quota";
export { HenrikDevError } from "./henrik-errors.ts";

const MAX_CACHE_ENTRIES = 200;
// Workerd may discard an originating request's timers along with its I/O.
const INFLIGHT_LEASE_MS = 16_000; // 15s transport plus best-effort cache I/O.

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
  return undefined;
}

export function markKeyCooldown(key: string, untilMs: number): void {
  keyCooldownUntil.set(key, untilMs);
}

// --- Response cache -----------------------------------------------------

// Layer 1: in-process Map (Node dev, per-isolate in workerd).
// Layer 2: Cloudflare Cache API — shared across isolates in the same colo,
// so most requests never reach the upstream API even on cold isolates.
const cache = new Map<string, { at: number; ttl: number; data: unknown }>();
const inflight = new Map<string, { task: Promise<unknown>; expiresAt: number }>();

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
    return await beforeDeadline((async () => {
      const res = await c.match(edgeKey(path));
      if (!res) return undefined;
      const body = (await res.json()) as EdgeBody;
      return body.exp > Date.now() ? body : undefined;
    })(), deadlineAfter(150));
  } catch {
    return undefined;
  }
}

async function writeEdgeCache(path: string, data: unknown, ttl: number): Promise<void> {
  const c = edgeCache();
  if (!c) return;
  try {
    const body: EdgeBody = { exp: Date.now() + ttl, data };
    await beforeDeadline(c.put(
      edgeKey(path),
      new Response(JSON.stringify(body), {
        headers: { "content-type": "application/json", "cache-control": `max-age=${Math.ceil(ttl / 1000)}` },
      }),
    ), deadlineAfter(150));
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
  priority?: HenrikPriority;
}

async function fetchOnce<T>(path: string, init?: HenrikCallOptions): Promise<T> {
  const keys = apiKeys();
  const first = pickKey();
  const index = first ? keys.indexOf(first) : 0;
  return requestHenrik<T>(path, [...keys.slice(index), ...keys.slice(0, index)], init ?? {}, markKeyCooldown);
}

export function henrikCall<T>(path: string, opts?: HenrikCallOptions): Promise<T> {
  const ttl = opts?.ttl ?? 60_000;
  // A fresh background read must not hold a valid interactive cache hit hostage.
  if (!opts?.fresh && ttl > 0) {
    const hit = readCache(path);
    if (hit !== undefined) return Promise.resolve(hit as T);
  }
  const now = Date.now();
  for (const [key, entry] of inflight) if (key !== path && entry.expiresAt <= now) inflight.delete(key);
  const pending = inflight.get(path);
  if (pending && pending.expiresAt > now) return pending.task as Promise<T>;
  if (pending) console.warn("[henrik] abandoned inflight lease replaced");
  const current = () => inflight.get(path)?.task === p;
  const p: Promise<T> = lookup<T>(path, opts, ttl, current).finally(() => {
    if (current()) inflight.delete(path);
  });
  inflight.set(path, { task: p, expiresAt: now + INFLIGHT_LEASE_MS });
  return p;
}

async function lookup<T>(path: string, opts: HenrikCallOptions | undefined, ttl: number, current: () => boolean): Promise<T> {
  if (!opts?.fresh && ttl > 0) {
    const hit = readCache(path) as T | undefined;
    if (hit !== undefined) return hit;
    const edge = await readEdgeCache(path);
    if (edge !== undefined) {
      if (current()) writeCache(path, edge.data, Math.min(ttl, edge.exp - Date.now()));
      return edge.data as T;
    }
  }
  const data = await fetchOnce<T>(path, opts);
  if (ttl > 0 && current()) {
    writeCache(path, data, ttl);
    await writeEdgeCache(path, data, ttl);
  }
  return data;
}
