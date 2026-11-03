// Real workerd/D1 compressed-profile round trip. No external services.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const esbuild = require("esbuild");
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require("miniflare");

(async () => {
  const built = await esbuild.build({
    stdin: { contents: `
      import seed from "./src/data/profile.json";
      import {writeProfileSnapshot,readProfileSnapshot,deleteProfileSnapshot,resetProfileCache}
        from "./src/lib/profile-cache";
      export default {async fetch(req,env){
        globalThis.__profileEnv={env};
        const key="native-profile";
        const data={bundle:{...seed,source:"henrikdev",matches:[],
          capturedAt:new Date(Date.now()-2*86400000).toISOString()},storedMatches:[]};
        await writeProfileSnapshot(key,data);
        resetProfileCache();
        await caches.default.delete(new Request("https://profile-cache.internal/v2/"+key));
        const restored=await readProfileSnapshot(key,Date.now()+5000);
        await deleteProfileSnapshot(key);
        await writeProfileSnapshot(key,data);
        resetProfileCache();
        const revoked=await readProfileSnapshot(key,Date.now()+5000);
        return Response.json({restored:JSON.stringify(restored)===JSON.stringify(data),revoked:revoked===null});
      }};`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", target: "es2022",
    plugins: [{ name: "d1-context", setup(build) {
      build.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: "context", namespace: "probe" }));
      build.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: "sqlite", namespace: "probe" }));
      build.onLoad({ filter: /.*/, namespace: "probe" }, ({ path }) => ({ contents: path === "context"
        ? "export function getCloudflareContext(){return globalThis.__profileEnv}"
        : 'export default class {constructor(){throw new Error("Must use real D1")}}',
      }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: built.outputFiles[0].text,
    compatibilityDate: "2026-10-27", compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "profile-runtime-probe" }, d1Persist: false,
    outboundService: () => { throw new Error("No external services allowed"); },
    log: new Log(LogLevel.ERROR),
  }));
  try {
    const db = await mf.getD1Database("DB");
    const sql = fs.readFileSync("db/upgrade-2026-11-04-profiles.sql", "utf8");
    await db.batch(sql.split(";").filter(s => s.trim()).map(s => db.prepare(s)));
    const response = await mf.dispatchFetch("http://profile-probe.test/");
    assert.equal(response.status, 200, await response.clone().text());
    assert.deepEqual(await response.json(), { restored: true, revoked: true });
    console.log("PASS: native workerd/D1 profile BLOB restore after cache eviction, retained capture time, invalidation fence; no external network");
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
