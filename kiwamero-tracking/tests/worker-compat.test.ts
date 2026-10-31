import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { prepareModuleLoadingPatch, assertRequestScopedSignal, sourcePath } =
  require("../tools/build-worker.cjs");
const original = readFileSync(sourcePath, "utf8");

test("the actual Next module-loading signal is isolated by request, preserving constructor arguments", async () => {
  const patch = await prepareModuleLoadingPatch();
  const patched = patch(original);
  assertRequestScopedSignal(patched);
  const storage = new AsyncLocalStorage<Record<string, unknown>>();
  const exports: Record<string, unknown> = {};
  const context = {
    exports, module: { exports }, require: createRequire(sourcePath),
    globalThis: { __openNextAls: storage },
  };
  vm.runInNewContext(patched + "\nmodule.exports.testSignal = getModuleLoadingSignal;", context);
  const signal = context.module.exports.testSignal as () => { immediateTracker: unknown };
  const first = storage.run({}, () => {
    const value = signal();
    assert.equal(signal(), value, "one request retains its own signal");
    return value;
  });
  const second = storage.run({}, signal);
  assert.notEqual(first, second, "requests must never share timer-backed CacheSignal instances");
  assert.equal(first.immediateTracker, null);
  assert.equal(second.immediateTracker, null);
  assert.equal(signal(), signal(), "non-request fallback remains stable");
});

test("the upstream zero-argument form remains supported", async () => {
  const patch = await prepareModuleLoadingPatch();
  const legacy = original.replace(".CacheSignal(null)", ".CacheSignal()");
  const patched = patch(legacy);
  assertRequestScopedSignal(patched);
  assert.match(patched, /new _cachesignal\.CacheSignal\(\)/);
});

test("the build gate rejects an unpatched Next module", () => {
  assert.throws(() => assertRequestScopedSignal(original), /not request-scoped/);
  assert.throws(() => assertRequestScopedSignal(""), /review adapter compatibility/);
});
