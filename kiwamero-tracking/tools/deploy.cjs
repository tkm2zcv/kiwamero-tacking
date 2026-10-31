const { spawnSync } = require("node:child_process");

// OPEN_NEXT_DEPLOY=true skips OpenNext's deploy delegation (its getPlatformProxy
// spawns a local workerd that cannot write under the project root on Windows),
// so plain `wrangler deploy` runs. Existing Cloudflare secrets are untouched.
const steps = [
  ["npm", ["run", "build:worker"]],
  ["npm", ["run", "scrub:bundle"]],
  ["npx", ["wrangler", "deploy"], { OPEN_NEXT_DEPLOY: "true" }],
];
for (const [cmd, args, extraEnv] of steps) {
  const r = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
