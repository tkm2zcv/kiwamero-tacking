import { execute, queryOne } from "./db.ts";

export type HenrikPriority = "interactive" | "background";
interface QuotaUse { at: number; priority: HenrikPriority }
interface QuotaRow { uses: string; cooldownUntil: number }
const hashes = new Map<string, Promise<string>>();

export function quotaLimits() {
  const number = (value: string | undefined, fallback: number) =>
    value && /^\d+$/.test(value) ? Math.max(1, Math.min(1000, Number(value))) : fallback;
  const rpm = number(process.env.HENRIK_KEY_RPM, 30);
  const background = Math.min(rpm - 1, number(process.env.HENRIK_BACKGROUND_RPM, 20));
  return { rpm, background };
}

async function quotaHash(key: string): Promise<string> {
  if (process.env.HENRIK_QUOTA_SCOPE === "shared") return "shared-provider-budget";
  if (!hashes.has(key)) hashes.set(key, crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))
    .then((buf) => [...new Uint8Array(buf)].map((n) => n.toString(16).padStart(2, "0")).join("")));
  return hashes.get(key)!;
}

/** One conditional SQL update: concurrent workers cannot overbook a key. */
export async function reserveQuota(key: string, priority: HenrikPriority, now = Date.now()) {
  const hash = await quotaHash(key);
  const { rpm, background } = quotaLimits();
  await execute("INSERT OR IGNORE INTO HenrikQuota(keyHash) VALUES (?)", [hash]);
  const active = `SELECT value FROM json_each(uses) WHERE json_extract(value, '$.at') > ?`;
  const row = await queryOne<{ keyHash: string }>(
    `UPDATE HenrikQuota
     SET uses = json_insert(
       (SELECT json_group_array(json(value)) FROM (${active})),
       '$[#]', json_object('at', ?, 'priority', ?))
     WHERE keyHash = ? AND cooldownUntil <= ?
       AND (SELECT count(*) FROM (${active})) < ?
       AND (? = 'interactive' OR
         (SELECT count(*) FROM (${active}) WHERE json_extract(value, '$.priority') = 'background') < ?)
     RETURNING keyHash`,
    [now - 60_000, now, priority, hash, now, now - 60_000, rpm,
      priority, now - 60_000, background],
  );
  if (row) return { ok: true as const, retryAt: now };
  const state = await queryOne<QuotaRow>("SELECT uses, cooldownUntil FROM HenrikQuota WHERE keyHash = ?", [hash]);
  const uses = (JSON.parse(state?.uses ?? "[]") as QuotaUse[]).filter((u) => u.at > now - 60_000);
  const totalWait = uses.length >= rpm ? Math.min(...uses.map((u) => u.at)) + 60_000 : now;
  const bg = uses.filter((u) => u.priority === "background");
  const backgroundWait = priority === "background" && bg.length >= background
    ? (bg.length ? Math.min(...bg.map((u) => u.at)) + 60_000 : now + 60_000) : now;
  return { ok: false as const, retryAt: Math.max(now + 1000, totalWait, backgroundWait, state?.cooldownUntil ?? 0) };
}

export async function coolQuota(key: string, until: number) {
  const hash = await quotaHash(key);
  await execute(
    `INSERT INTO HenrikQuota(keyHash, cooldownUntil) VALUES (?, ?)
     ON CONFLICT(keyHash) DO UPDATE SET cooldownUntil = max(cooldownUntil, excluded.cooldownUntil)`,
    [hash, until],
  );
}

export function retryAfterMs(value: string | null, now = Date.now()) {
  if (!value) return 60_000;
  const seconds = Number(value);
  const delay = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) && delay > 0 ? delay : 60_000;
}
