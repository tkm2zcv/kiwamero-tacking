const fs = require("node:fs");
const path = require("node:path");

// OpenNext inlines project .env* files into .open-next/cloudflare/next-env.mjs
// for process.env fallbacks, and that module lands inside the deployed worker
// bundle. Cloudflare bindings/secrets are applied first (populateProcessEnv
// uses ??=), so emptying the exports loses nothing and keeps literal secret
// material out of the uploaded artifact.
const nextEnv = path.join(__dirname, "..", ".open-next", "cloudflare", "next-env.mjs");
if (fs.existsSync(nextEnv)) {
  fs.writeFileSync(
    nextEnv,
    "export const production = {};\nexport const development = {};\nexport const test = {};\n",
  );
  console.log("[scrub] emptied", nextEnv);
} else {
  console.warn("[scrub] missing", nextEnv, "(run after build:worker)");
}

// Next standalone also copies .env* into the server bundle dir; it is outside
// the module graph and not uploaded, but remove the stray copy anyway.
const serverDotenv = path.join(__dirname, "..", ".open-next", "server-functions", "default", ".env");
if (fs.existsSync(serverDotenv)) {
  fs.rmSync(serverDotenv, { force: true });
  console.log("[scrub] removed", serverDotenv);
}
