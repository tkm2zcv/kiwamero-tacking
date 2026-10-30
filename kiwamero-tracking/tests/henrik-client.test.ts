import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { execute } from "../src/lib/db.ts";
import {
  apiKeys,
  henrikCall,
  pickKey,
  resetHenrikClient,
} from "../src/lib/henrik-client.ts";

const realFetch = globalThis.fetch;
process.env.DATABASE_URL = "file::memory:";
test.before(async () => {
  const sql = fs.readFileSync("db/upgrade-2026-10-30.sql", "utf8");
  for (const statement of sql.split(";").map((s) => s.trim()).filter(Boolean)) await execute(statement);
});
const KEY_ENV = ["HENRIK_API_KEY", "HENRIK_API_KEYS"] as const;

function stubFetch(
  handler: (url: string, auth?: string) => { status: number; data?: unknown; headers?: Record<string, string> },
) {
  if (!apiKeys().length) process.env.HENRIK_API_KEY = "test-only-key";
  const calls: { url: string; auth?: string }[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get("Authorization") ?? undefined;
    calls.push({ url, auth });
    const r = handler(url, auth);
    return new Response(
      JSON.stringify({ status: r.status, data: r.data ?? {}, errors: r.status === 200 ? undefined : [{ message: "err" }] }),
      { status: r.status, headers: r.headers },
    );
  }) as typeof fetch;
  return calls;
}

function stubEdgeCache() {
  const store = new Map<string, string>();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (req: Request) => {
        const body = store.get(req.url);
        return body ? new Response(body) : undefined;
      },
      put: async (req: Request, res: Response) => {
        store.set(req.url, await res.text());
      },
    },
  };
  return store;
}

test.afterEach(async () => {
  globalThis.fetch = realFetch;
  delete (globalThis as { caches?: unknown }).caches;
  resetHenrikClient();
  for (const k of KEY_ENV) delete process.env[k];
  await execute("DELETE FROM HenrikQuota");
});

test("henrikCall caches responses within the TTL", async () => {
  const calls = stubFetch(() => ({ status: 200, data: { ok: 1 } }));
  const a = await henrikCall("/x", { ttl: 60_000 });
  const b = await henrikCall("/x", { ttl: 60_000 });
  assert.deepEqual(a, { ok: 1 });
  assert.deepEqual(b, { ok: 1 });
  assert.equal(calls.length, 1);
});

test("fresh bypasses the cache and rewrites it", async () => {
  let n = 0;
  const calls = stubFetch(() => ({ status: 200, data: { n: ++n } }));
  await henrikCall("/x", { ttl: 60_000 });
  const fresh = await henrikCall("/x", { ttl: 60_000, fresh: true });
  assert.deepEqual(fresh, { n: 2 });
  const cached = await henrikCall("/x", { ttl: 60_000 });
  assert.deepEqual(cached, { n: 2 });
  assert.equal(calls.length, 2);
});

test("concurrent calls share one in-flight request", async () => {
  const calls = stubFetch(() => ({ status: 200, data: { ok: 1 } }));
  const [a, b] = await Promise.all([henrikCall("/x"), henrikCall("/x")]);
  assert.deepEqual(a, b);
  assert.equal(calls.length, 1);
});

test("errors are not cached", async () => {
  let n = 0;
  const calls = stubFetch(() => ({ status: ++n === 1 ? 500 : 200, data: { ok: 1 } }));
  await assert.rejects(henrikCall("/x"));
  const ok = await henrikCall("/x");
  assert.deepEqual(ok, { ok: 1 });
  assert.equal(calls.length, 2);
});

test("apiKeys merges HENRIK_API_KEYS and legacy HENRIK_API_KEY", () => {
  process.env.HENRIK_API_KEY = "solo";
  process.env.HENRIK_API_KEYS = " k1, k2 ,,k1";
  assert.deepEqual(apiKeys(), ["k1", "k2", "solo"]);
  delete process.env.HENRIK_API_KEYS;
  assert.deepEqual(apiKeys(), ["solo"]);
});

test("429 rotates to the next key and marks the first in cooldown", async () => {
  process.env.HENRIK_API_KEYS = "key-a,key-b";
  const auths: (string | undefined)[] = [];
  stubFetch((_url, auth) => {
    auths.push(auth);
    return auth === "key-a" ? { status: 429 } : { status: 200, data: { ok: 1 } };
  });
  const res = await henrikCall("/x");
  assert.deepEqual(res, { ok: 1 });
  assert.deepEqual(auths, ["key-a", "key-b"]);
  // key-a stays in cooldown on the next request
  assert.equal(pickKey(), "key-b");
});

test("edge cache serves a different isolate's fetch", async () => {
  stubEdgeCache();
  const calls = stubFetch(() => ({ status: 200, data: { ok: 1 } }));
  await henrikCall("/x", { ttl: 60_000 });
  assert.equal(calls.length, 1);
  // Simulate a different isolate: local state cleared, edge store persists.
  resetHenrikClient();
  const res = await henrikCall("/x", { ttl: 60_000 });
  assert.deepEqual(res, { ok: 1 });
  assert.equal(calls.length, 1); // no upstream call
});

test("expired edge entries fall through to upstream", async () => {
  stubEdgeCache();
  let n = 0;
  const calls = stubFetch(() => ({ status: 200, data: { n: ++n } }));
  await henrikCall("/x", { ttl: 1 }); // expires immediately
  resetHenrikClient();
  await new Promise((r) => setTimeout(r, 5));
  const res = await henrikCall("/x", { ttl: 60_000 });
  assert.deepEqual(res, { n: 2 });
  assert.equal(calls.length, 2);
});

test("all keys cooling never forces an extra request", async () => {
  process.env.HENRIK_API_KEYS = "key-a,key-b";
  const calls = stubFetch(() => ({ status: 429 }));
  await assert.rejects(henrikCall("/x"));
  assert.equal(calls.length, 2); // tried both keys before giving up
  await assert.rejects(henrikCall("/other"));
  assert.equal(calls.length, 2);
});

test("429 rotation can reach the fourth key without leaking upstream messages", async () => {
  process.env.HENRIK_API_KEYS = "test-a,test-b,test-c,test-d";
  const calls = stubFetch((_url, auth) => auth === "test-d"
    ? { status: 200, data: { ok: true } } : { status: 429, headers: { "retry-after": "120" } });
  assert.deepEqual(await henrikCall("/four-key"), { ok: true });
  assert.equal(calls.length, 4);
});

test("cooldowns remain enforced after clearing isolate-local client state", async () => {
  process.env.HENRIK_API_KEYS = "test-a";
  const calls = stubFetch(() => ({ status: 429 }));
  await assert.rejects(henrikCall("/one"));
  resetHenrikClient();
  await assert.rejects(henrikCall("/two"));
  assert.equal(calls.length, 1);
});

test("an invalid key cools without poisoning a public match; private 403 never rotates", async () => {
  process.env.HENRIK_API_KEYS = "invalid-test,valid-test";
  const calls = stubFetch((_url, auth) => auth === "invalid-test"
    ? { status: 401 } : { status: 200, data: { ok: true } });
  assert.deepEqual(await henrikCall("/public"), { ok: true });
  assert.equal(calls.length, 2);
  const forbidden = stubFetch(() => ({ status: 403 }));
  await assert.rejects(henrikCall("/private"), { status: 403 });
  assert.equal(forbidden.length, 1);
});

test("missing credentials fail closed without any upstream request", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ status: 200, data: {} }); };
  await assert.rejects(henrikCall("/unconfigured"), { status: 503 });
  assert.equal(calls, 0);
});

test("transport and invalid-body errors cannot expose credential-bearing messages", async () => {
  process.env.HENRIK_API_KEY = "sensitive-test-only-value";
  globalThis.fetch = async () => { throw new Error("invalid header: sensitive-test-only-value"); };
  await assert.rejects(henrikCall("/network-error"), { status: 503, message: "HenrikDev transport unavailable" });
  globalThis.fetch = async () => new Response("sensitive-test-only-value", { status: 200 });
  await assert.rejects(henrikCall("/invalid-json"), { status: 502, message: "Invalid HenrikDev response" });
  globalThis.fetch = async () => Response.json(null);
  await assert.rejects(henrikCall("/invalid-envelope"), { status: 502, message: "Invalid HenrikDev response" });
});
