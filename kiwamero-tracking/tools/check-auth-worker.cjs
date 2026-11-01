// Real workerd/D1 auth checks with a deliberately abandoned schema I/O boundary.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const esbuild = require("esbuild");
const { Miniflare, Log, LogLevel, convertV4MiniflareOptions } = require("miniflare");

(async () => {
  const built = await esbuild.build({
    stdin: { contents: String.raw`
      import {AsyncLocalStorage} from "node:async_hooks";
      import {serializeSignedCookie} from "better-call";
      import {auth} from "./src/lib/auth";
      import {getSiteAccess} from "./src/lib/site-access";
      const storage=new AsyncLocalStorage();
      globalThis.__authProbeContext=storage;
      let schemaProbes=0, users=0;
      export default {
        fetch(request,env) {
          const DB={prepare(query){
            return {bind(...params){
              return {all(){
                if(/sqlite_master|sqlite_schema|pragma_/i.test(query)){
                  schemaProbes++; return new Promise(()=>{});
                }
                return env.DB.prepare(query).bind(...params).all();
              }};
            }};
          }};
          return storage.run({env:{DB}},async()=>{
            const url=new URL(request.url);
            if(url.pathname==="/bootstrap"){
              const ctx=await auth.$context;
              const user=await ctx.internalAdapter.createUser(
                {email:"probe-"+(++users)+"@example.test",name:"auth-probe"},
                {method:"oauth",oauth:{providerId:"discord"}});
              const accountId=url.searchParams.has("unlisted")?"222222222222222222":"111111111111111111";
              await ctx.internalAdapter.createAccount({userId:user.id,accountId,providerId:"discord"});
              const session=await ctx.internalAdapter.createSession(user.id,false);
              const cookie=(await serializeSignedCookie(
                ctx.authCookies.sessionToken.name,session.token,ctx.secret)).split(";")[0];
              return Response.json({cookie});
            }
            const access=await getSiteAccess(request.headers);
            return Response.json({status:access.status,schemaProbes});
          });
        }
      };`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "esm", target: "es2022",
    plugins: [{ name: "worker-context-boundaries", setup(build) {
      build.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: "context", namespace: "probe" }));
      build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server", namespace: "probe" }));
      build.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: "sqlite", namespace: "probe" }));
      build.onLoad({ filter: /.*/, namespace: "probe" }, ({ path }) => ({ contents:
        path === "context" ? `export function getCloudflareContext(){
          const ctx=globalThis.__authProbeContext?.getStore();
          if(!ctx)throw new Error("Missing worker request context");
          return ctx;
        }` : path === "sqlite" ? 'export default class {constructor(){throw new Error("Worker must use real D1")}}' : "",
      }));
    } }],
  });
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: built.outputFiles[0].text,
    compatibilityDate: "2026-10-27", compatibilityFlags: ["nodejs_compat"],
    d1Databases: { DB: "auth-runtime-probe" }, d1Persist: false,
    bindings: {
      NODE_ENV: "production", BETTER_AUTH_URL: "http://auth-probe.test",
      BETTER_AUTH_SECRET: "test-only-runtime-probe-N9qW5vB2zP8cX6mL",
      DISCORD_CLIENT_ID: "offline-client", DISCORD_CLIENT_SECRET: "offline-secret",
      OWNER_DISCORD_IDS: "111111111111111111",
    },
    outboundService: () => { throw new Error("Auth probe must not access external services"); },
    log: new Log(LogLevel.ERROR),
  }));
  try {
    const db = await mf.getD1Database("DB");
    const sql = fs.readFileSync("db/schema.sql", "utf8").replace(/^\uFEFF/, "");
    const statements = sql.split(";").map(s => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
    await db.batch(statements.map(s => db.prepare(s)));
    const read = async (path, cookie) => {
      const response = await mf.dispatchFetch("http://auth-probe.test" + path,
        { headers: cookie ? { cookie } : {} });
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    assert.deepEqual(await read("/"), { status: "anonymous", schemaProbes: 0 });
    const { cookie } = await read("/bootstrap");
    for (let i = 0; i < 3; i++) {
      assert.deepEqual(await read("/", cookie), { status: "allowed", schemaProbes: 0 });
    }
    assert.deepEqual(await read("/", cookie + "tampered"), { status: "anonymous", schemaProbes: 0 });
    const unlisted = await read("/bootstrap?unlisted=1");
    assert.deepEqual(await read("/", unlisted.cookie), { status: "denied", schemaProbes: 0 });
    console.log("PASS: real workerd/D1 session across requests; signature and Discord allowlist enforced; zero schema probes/network calls");
  } finally {
    await mf.dispose();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
