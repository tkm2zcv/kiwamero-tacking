import { beforeDeadline } from "./deadline.ts";
import type { ProfileBundle } from "./types";
import type { HDStoredMatch } from "./henrik-model";
import type { ProfileLoadOptions } from "./profile-source";

export const PROFILE_FRESH_MS = 60_000;
const RETAIN_MS = 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 16;
const MAX_BYTES = 1_800_000;
const MAX_RAW_BYTES = 8_000_000;
const MAX_MEMORY_BYTES = 8_000_000;
export interface ProfileSnapshot {
  bundle: ProfileBundle;
  storedMatches: HDStoredMatch[];
}
const memory = new Map<string, ArrayBuffer>();
let memoryBytes = 0;
const refreshing = new Map<string, { expiresAt: number }>();

export function profileCacheKey(name: string, tag: string, opts?: ProfileLoadOptions): string {
  return JSON.stringify([name.toLowerCase(), tag.toLowerCase(), opts?.mode ?? "all",
    opts?.includeRecentMatches !== false, opts?.includeStoredMatches !== false]);
}
function edge(): Cache | undefined {
  return (globalThis as { caches?: { default?: Cache } }).caches?.default;
}
function request(key: string): Request {
  return new Request(`https://profile-cache.internal/v2/${encodeURIComponent(key)}`);
}
async function decode(packed?: ArrayBuffer): Promise<ProfileSnapshot | null> {
  if (!packed || packed.byteLength > MAX_BYTES) return null;
  try {
    let expanded = 0;
    const limit = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        expanded += chunk.byteLength;
        if (expanded > MAX_RAW_BYTES) throw new Error("Snapshot exceeds decoded size limit");
        controller.enqueue(chunk);
      },
    });
    const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("gzip")).pipeThrough(limit);
    const data = await new Response(stream).json() as ProfileSnapshot;
    const age = Date.now() - Date.parse(data.bundle.capturedAt);
    return data.bundle.source === "henrikdev" && age >= 0 && age < RETAIN_MS &&
      Array.isArray(data.storedMatches) ? data : null;
  } catch { return null; }
}

export async function readProfileSnapshot(key: string, deadline: number): Promise<ProfileSnapshot | null> {
  try {
    // A degraded cache must not consume the page's upstream budget.
    return await beforeDeadline((async () => {
      const local = await decode(memory.get(key));
      if (local) return local;
      forget(key);
      const response = await edge()?.match(request(key));
      const packed = await response?.arrayBuffer();
      const data = await decode(packed);
      if (data && packed) remember(key, packed);
      return data;
    })(), Math.min(deadline, Date.now() + 300));
  } catch { return null; }
}
function forget(key: string) {
  memoryBytes -= memory.get(key)?.byteLength ?? 0;
  memory.delete(key);
}
function remember(key: string, packed: ArrayBuffer) {
  forget(key);
  while (memory.size >= MAX_ENTRIES || memoryBytes + packed.byteLength > MAX_MEMORY_BYTES) {
    forget(memory.keys().next().value!);
  }
  memory.set(key, packed);
  memoryBytes += packed.byteLength;
}
export async function writeProfileSnapshot(key: string, data: ProfileSnapshot): Promise<void> {
  const json = JSON.stringify(data);
  if (json.length > MAX_RAW_BYTES || new TextEncoder().encode(json).byteLength > MAX_RAW_BYTES) {
    // A growing profile must not remain stuck on an older, smaller snapshot.
    await deleteProfileSnapshot(key);
    return;
  }
  // Keep every match; raw histories often exceed 1.8MB but compress very well.
  const packed = await new Response(new Blob([json]).stream()
    .pipeThrough(new CompressionStream("gzip"))).arrayBuffer();
  if (packed.byteLength > MAX_BYTES) {
    await deleteProfileSnapshot(key);
    return;
  }
  remember(key, packed);
  try {
    await edge()?.put(request(key), new Response(packed, {
      headers: { "content-type": "application/octet-stream", "cache-control": `max-age=${RETAIN_MS / 1000}` },
    }));
  } catch { /* Best-effort cache; never fail the profile. */ }
}
export async function deleteProfileSnapshot(key: string): Promise<void> {
  forget(key);
  try { await edge()?.delete(request(key)); } catch { /* Best effort. */ }
}
/** Coalesce refreshes in an isolate; HTTP reads also dedupe across page variants. */
export function refreshProfileSnapshot(key: string, defer: (task: () => Promise<void>) => void, task: () => Promise<void>) {
  const now = Date.now();
  for (const [id, entry] of refreshing) if (entry.expiresAt <= now) refreshing.delete(id);
  if (refreshing.has(key)) return;
  const lease = { expiresAt: now + 45_000 };
  refreshing.set(key, lease);
  defer(async () => {
    if (refreshing.get(key) !== lease) return;
    try { await task(); } finally {
      if (refreshing.get(key) === lease) refreshing.delete(key);
    }
  });
}
export function resetProfileCache() {
  memory.clear();
  memoryBytes = 0;
  refreshing.clear();
}
