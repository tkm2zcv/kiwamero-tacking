// Native workerd fetch semantics; all outbound traffic stays in local fixtures.
const assert = require("node:assert/strict");
const esbuild = require("esbuild");
const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = require("miniflare");

(async () => {
  const bundle = await esbuild.build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
      import {createWatchDeps} from "./src/lib/watch-run";
      import {iconData,loadFonts} from "./src/lib/watch-card";
      export default {async fetch(request){
        const path=new URL(request.url).pathname;
        if(path==="/icon")return Response.json({data:await iconData("https://media.valorant-api.com/test.png")});
        if(path==="/fonts")return Response.json({count:(await loadFonts()).length});
        const deps=createWatchDeps();
        const host=path==="/json"?"discordapp.com":"discord.com";
        const url="https://"+host+"/api/webhooks/"+(path==="/redirect"?"2":"1")+"/abcdefghijklmnopqrstuvwx";
        const files=path==="/file"?[{name:"watch-match.png",type:"image/png",data:new Uint8Array([137,80,78,71])}]:undefined;
        return Response.json({ok:await deps.sendWebhook(url,{embeds:[{title:"offline probe"}]},files)});
      }};` },
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "server-boundaries", setup(build) {
      build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server", namespace: "fixture" }));
      build.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: "context", namespace: "fixture" }));
      build.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: "sqlite", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents:
        path === "context" ? 'export function getCloudflareContext(){throw new Error("No DB in fetch-only probe")}' :
        path === "sqlite" ? 'export default class {constructor(){throw new Error("No SQLite in fetch-only probe")}}' : "",
      }));
    } }],
  });
  const calls = [];
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: true, script: bundle.outputFiles[0].text,
    compatibilityDate: "2026-10-27", compatibilityFlags: ["nodejs_compat"],
    outboundService: async request => {
      const url = new URL(request.url);
      calls.push({ host: url.hostname, method: request.method, type: request.headers.get("content-type") });
      if (url.hostname === "discord.com") {
        assert.equal(request.method, "POST");
        assert.ok((await request.arrayBuffer()).byteLength > 0);
        return url.pathname.includes("/2/")
          ? new Response(null, { status: 302, headers: { location: "https://untrusted.example/" } })
          : new Response(null, { status: 204 });
      }
      if (url.hostname === "media.valorant-api.com") {
        return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return new Response("@font-face {font-weight:400;src:url(https://fonts.gstatic.com/test.woff2)}");
      }
      if (url.hostname === "fonts.gstatic.com") return new Response(new Uint8Array([1, 2, 3]));
      throw new Error("Unexpected outbound target; no real external network is allowed");
    },
    log: new Log(LogLevel.ERROR),
  }));
  try {
    const read = async path => {
      const response = await mf.dispatchFetch("http://watch-probe.test" + path);
      assert.equal(response.status, 200, await response.clone().text());
      return response.json();
    };
    assert.deepEqual(await read("/json"), { ok: true });
    assert.deepEqual(await read("/file"), { ok: true });
    assert.deepEqual(await read("/redirect"), { ok: false });
    assert.equal(calls.filter(c => c.host === "discord.com").length, 3);
    assert.ok(calls[1].type.startsWith("multipart/form-data"));
    assert.deepEqual(await read("/icon"), { data: "data:image/png;base64,iVBORw==" });
    assert.deepEqual(await read("/fonts"), { count: 1 });
    assert.ok(!calls.some(c => c.host === "untrusted.example"));
    console.log("PASS: native workerd JSON/multipart webhook, icons/fonts, and redirect rejection; no external messages/network");
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
