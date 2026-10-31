import test from "node:test";
import assert from "node:assert/strict";
import { ImageSearchSession } from "../src/lib/image-search-session.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

function worker() {
  return { stops: 0, async terminate() { this.stops++; } };
}
const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test("successful image jobs return their own result and dispose the worker", async () => {
  const session = new ImageSearchSession();
  const w = worker();
  assert.equal(await session.run(async () => w, async () => "Meiy#B3L"), "Meiy#B3L");
  assert.equal(w.stops, 1);
});

test("closing during recognition stops the worker and resolves cancellation immediately", async () => {
  const session = new ImageSearchSession();
  const w = worker(), reading = deferred<string>();
  let signal: AbortSignal | undefined;
  const run = session.run(async () => w, async (_w, current) => { signal = current; return reading.promise; });
  await tick();
  session.cancel();
  assert.equal(await run, undefined);
  assert.equal(w.stops, 1);
  assert.equal(signal?.aborted, true);
  reading.resolve("stale");
  await tick();
  assert.equal(w.stops, 1);
});

test("an old late result cannot overwrite a new image or terminate its worker", async () => {
  const session = new ImageSearchSession();
  const a = worker(), b = worker();
  const first = deferred<string>(), second = deferred<string>();
  const oldRun = session.run(async () => a, async () => first.promise);
  await tick();
  const newRun = session.run(async () => b, async () => second.promise);
  await tick();
  first.resolve("old");
  assert.equal(await oldRun, undefined);
  assert.equal(a.stops, 1);
  assert.equal(b.stops, 0);
  second.resolve("new");
  assert.equal(await newRun, "new");
  assert.equal(b.stops, 1);
});

test("close while initializing disposes the worker when initialization eventually completes", async () => {
  const session = new ImageSearchSession();
  const ready = deferred<ReturnType<typeof worker>>();
  let reads = 0;
  const run = session.run(() => ready.promise, async () => { reads++; return "unused"; });
  session.cancel();
  assert.equal(await run, undefined);
  const w = worker();
  ready.resolve(w);
  await tick();
  assert.equal(reads, 0);
  assert.equal(w.stops, 1);
});

test("old initialization and recognition failures cannot clear the newer job", async () => {
  const session = new ImageSearchSession();
  const oldReady = deferred<ReturnType<typeof worker>>();
  const oldRun = session.run(() => oldReady.promise, async () => "old");
  const b = worker(), nextResult = deferred<string>();
  const next = session.run(async () => b, async () => nextResult.promise);
  oldReady.reject(new Error("old initialization failed"));
  assert.equal(await oldRun, undefined);
  await tick();
  assert.equal(b.stops, 0);
  nextResult.resolve("new");
  assert.equal(await next, "new");
});

test("a current OCR failure is surfaced and cleaned up, and retry remains available", async () => {
  const session = new ImageSearchSession();
  const w = worker();
  await assert.rejects(session.run(async () => w, async () => { throw new Error("OCR failed"); }), /OCR failed/);
  assert.equal(w.stops, 1);
  await assert.rejects(session.run(async () => { throw new Error("download failed"); }, async () => "unused"), /download failed/);
  assert.equal(await session.run(async () => worker(), async () => "retry"), "retry");
});
