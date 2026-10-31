import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PaddleOcrClient, PADDLE_OCR_BASE } from "../src/lib/image-search-paddle.ts";
import { ImageSearchSession } from "../src/lib/image-search-session.ts";

function fakePort() {
  const messages: { id: number; type: string; image?: ArrayBuffer }[] = [];
  const port = {
    messages, stops: 0,
    onmessage: null as Worker["onmessage"],
    onerror: null as Worker["onerror"],
    onmessageerror: null as Worker["onmessageerror"],
    postMessage(message: { id: number; type: string; image?: ArrayBuffer }) { messages.push(message); },
    terminate() { this.stops++; },
    emit(data: unknown) { (this.onmessage as ((event: MessageEvent) => void) | null)?.({ data } as MessageEvent); },
  };
  return port;
}

test("Paddle OCR passes real name spaces through without insertion, collapse or removal", async () => {
  const port = fakePort(), updates: unknown[] = [];
  const client = new PaddleOcrClient(port, progress => updates.push(progress));
  const load = client.load();
  port.emit({ id: 1, type: "progress", stage: "loading", loaded: 50, total: 100 });
  port.emit({ id: 1, type: "ready" });
  await load;
  assert.equal(updates.length, 1);
  const names = ["crazy Boberツ野獣先輩#1994", "Team  Player#JP1", "おな ちゅ#3409", "おなちゅ#3409"];
  const run = client.recognize(new ArrayBuffer(4));
  port.emit({ id: 2, type: "result", results: names.map(text => ({ text })) });
  assert.deepEqual(await run, names);
  await client.terminate();
  await client.terminate();
  assert.equal(port.stops, 1);
});

test("Paddle initialization is immediately cancellable before models are ready", async () => {
  const port = fakePort(), client = new PaddleOcrClient(port, () => {});
  const session = new ImageSearchSession<PaddleOcrClient>();
  const run = session.run(async () => client, async c => { await c.load(); return "stale"; });
  await Promise.resolve(); await Promise.resolve();
  session.cancel();
  assert.equal(await run, undefined);
  assert.equal(port.stops, 1);
  port.emit({ id: 1, type: "ready" });
  assert.equal(port.stops, 1);
});

test("stale worker messages cannot complete or report progress for a later request", async () => {
  const port = fakePort(), updates: unknown[] = [], client = new PaddleOcrClient(port, p => updates.push(p));
  const load = client.load();
  port.emit({ id: 999, type: "ready" });
  port.emit({ id: 999, type: "progress", stage: "loading", loaded: 1, total: 1 });
  assert.equal(updates.length, 0);
  port.emit({ id: 1, type: "ready" });
  await load;
  const run = client.recognize(new ArrayBuffer(1));
  port.emit({ id: 1, type: "result", results: [{ text: "stale" }] });
  port.emit({ id: 2, type: "result", results: [{ text: "correct" }] });
  assert.deepEqual(await run, ["correct"]);
  await client.terminate();
});

test("model and worker failures reject rather than hang, including termination during a request", async () => {
  const port = fakePort(), client = new PaddleOcrClient(port, () => {});
  const load = client.load();
  port.emit({ id: 1, type: "error" });
  await assert.rejects(load, /OCR failed/);
  const run = client.recognize(new ArrayBuffer(1));
  await client.terminate();
  await assert.rejects(run, /unavailable/);
  await assert.rejects(client.load(), /unavailable/);
});

test("invalid worker results do not become player name candidates", async () => {
  const port = fakePort(), client = new PaddleOcrClient(port, () => {});
  const run = client.recognize(new ArrayBuffer(1));
  port.emit({ id: 1, type: "result", results: [{ text: 123 }] });
  await assert.rejects(run, /Invalid OCR results/);
  await client.terminate();
});

test("pinned Japanese runtime/models are intact and each fits Cloudflare's static asset size limit", () => {
  const base = new URL(`../public${PADDLE_OCR_BASE}/`, import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("assets.json", base), "utf8"));
  assert.equal(manifest.model, "PP-OCRv6 small (Japanese supported)");
  assert.equal(Object.keys(manifest.files).length, 6);
  for (const [file, metadata] of Object.entries(manifest.files) as [string, { bytes: number; sha256: string }][]) {
    const bytes = readFileSync(new URL(file, base));
    assert.equal(bytes.length, metadata.bytes);
    assert.ok(bytes.length < 25 * 1024 * 1024, file);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), metadata.sha256, file);
  }
});
