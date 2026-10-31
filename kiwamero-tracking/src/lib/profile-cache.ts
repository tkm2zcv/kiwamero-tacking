import { beforeDeadline } from "./deadline.ts";
import type { ProfileBundle } from "./types";
import type { HDStoredMatch } from "./henrik-model";
import type { ProfileLoadOptions } from "./profile-source";

export const PROFILE_FRESH_MS = 60_000;
const RETAIN_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 16;
const MAX_BYTES = 1_800_000;
export interface ProfileSnapshot {
  bundle: ProfileBundle;
  storedMatches: HDStoredMatch[];
}
const memory = new Map<string, string>();
const refreshing = new Set<string>();

export function profileCacheKey(name: string, tag: string, opts?: ProfileLoadOptions): string {
  return JSON.stringify([name.toLowerCase(), tag.toLowerCase(), opts?.mode ?? "all",
    opts?.includeRecentMatches !== false, opts?.includeStoredMatches !== false]);
}
function edge(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}
function request(key: string): Request {
  return new Request(`https://profile-cache.internal/v1/${encodeURIComponent(key)}`);
}
function decode(json?: string): ProfileSnapshot | null {
  if (!json) return null;
  try {
    const data = JSON.parse(json) as ProfileSnapshot;
    const age = Date.now() - Date.parse(data.bundle.capturedAt);
    return data.bundle.source === "henrikdev" && age >= 0 && age < RETAIN_MS &&
      Array.isArray(data.storedMatches) ? data : null;
  } catch { return null; }
}

export async function readProfileSnapshot(key: string, deadline: number): Promise<ProfileSnapshot | null> {
  const local = decode(memory.get(key));
  if (local) return local;
  memory.delete(key);
  try {
    // A degraded cache must not consume the page's upstream budget.
    return await beforeDeadline((async () => {
      const response = await edge()?.match(request(key));
      const json = await response?.text();
      const data = decode(json);
      if (data && json) remember(key, json);
      return data;
    })(), Math.min(deadline, Date.now() + 150));
  } catch { return null; }
}
function remember(key: string, json: string) {
  memory.delete(key);
  if (memory.size >= MAX_ENTRIES) memory.delete(memory.keys().next().value!);
  memory.set(key, json);
}
export async function writeProfileSnapshot(key: string, data: ProfileSnapshot): Promise<void> {
  const json = JSON.stringify(data);
  if (new TextEncoder().encode(json).byteLength > MAX_BYTES) {
    // A growing profile must not remain stuck on an older, smaller snapshot.
    await deleteProfileSnapshot(key);
    return;
  }
  remember(key, json);
  try {
    await edge()?.put(request(key), new Response(json, {
      headers: { "content-type": "application/json", "cache-control": `max-age=${RETAIN_MS / 1000}` },
    }));
  } catch { /* Best-effort cache; never fail the profile. */ }
}
export async function deleteProfileSnapshot(key: string): Promise<void> {
  memory.delete(key);
  try { await edge()?.delete(request(key)); } catch { /* Best effort. */ }
}
/** Coalesce refreshes in an isolate; HTTP reads also dedupe across page variants. */
export function refreshProfileSnapshot(key: string, defer: (task: () => Promise<void>) => void, task: () => Promise<void>) {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  defer(async () => {
    try { await task(); } finally { refreshing.delete(key); }
  });
}
export function resetProfileCache() {
  memory.clear();
  refreshing.clear();
}
