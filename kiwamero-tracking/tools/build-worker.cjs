const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "..");
const cloudflare = path.join(root, "node_modules/@opennextjs/cloudflare/dist");
const sourcePath = path.join(root,
  "node_modules/next/dist/server/app-render/module-loading/track-module-loading.instance.js");

async function prepareModuleLoadingPatch() {
  const plugin = await import(pathToFileURL(path.join(cloudflare,
    "cli/build/patches/plugins/module-loading.js")).href);
  const { patchCode } = await import("@opennextjs/aws/build/patch/astCodePatcher.js");
  // Next 16.4 passes null; upstream 1.20.13 only matches CacheSignal().
  // Keep constructor arguments while retaining the upstream request-scoping fix.
  const rule = plugin.moduleLoadingSignalRule
    .split(".CacheSignal()").join(".CacheSignal($$$ARGS)");
  const patch = (code) => patchCode(code, rule);
  assertRequestScopedSignal(patch(fs.readFileSync(sourcePath, "utf8")));
  plugin.patchModuleLoadingSignal.patches[0].patchCode = ({ code }) => patch(code);
  return patch;
}

function assertRequestScopedSignal(code) {
  const start = code.indexOf("function getModuleLoadingSignal(");
  assert.ok(start >= 0, "Cannot verify Next module-loading signal; review adapter compatibility");
  const body = code.slice(start, start + 700);
  assert.match(body, /__openNextAls/, "Worker module-loading signal is not request-scoped");
  assert.match(body, /requestStore\.moduleLoadingSignal/,
    "Worker is missing the request-local module-loading signal");
}

module.exports = { prepareModuleLoadingPatch, assertRequestScopedSignal, sourcePath };

if (require.main === module) {
  (async () => {
    await prepareModuleLoadingPatch();
    await import(pathToFileURL(path.join(cloudflare, "cli/index.js")).href);
    const worker = fs.readFileSync(path.join(root, ".open-next/server-functions/default/handler.mjs"), "utf8");
    assertRequestScopedSignal(worker);
    console.log("[compat] verified request-scoped module-loading signal in Worker bundle");
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
