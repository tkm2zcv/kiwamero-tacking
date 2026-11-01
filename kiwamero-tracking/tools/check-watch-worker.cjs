// Native workerd fetch semantics; all outbound traffic stays in local fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const esbuild = require("esbuild");
const { Miniflare, convertV4MiniflareOptions, Log, LogLevel } = require("miniflare");

(async () => {
  const bundle = await esbuild.build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
      import "./src/worker.js";
      import {createWatchDeps} from "./src/lib/watch-run";
      import {iconData,loadFonts,renderWatchCard} from "./src/lib/watch-card";
      import {summarizeMatchForNotify,buildAttachmentPayload} from "./src/lib/watch-core";
      async function renderProbe(){
          const match=summarizeMatchForNotify({
            metadata:{matchid:"probe-match",map:"Sunset",mode:"Competitive",rounds_played:22,game_start:1793500000},
            teams:{red:{has_won:true,rounds_won:13},blue:{has_won:false,rounds_won:9}},
            players:[{puuid:"probe",name:"Probe",tag:"TEST",character:"Jett",team:"Red",
              stats:{score:4400,kills:20,deaths:10,assists:4}}]
          },"probe");
          return renderWatchCard(match,{name:"Probe",tag:"TEST"});
      }
      export default {async fetch(request){
        const path=new URL(request.url).pathname;
        if(path==="/icon")return Response.json({data:await iconData("https://media.valorant-api.com/test.png")});
        if(path==="/fonts")return Response.json({count:(await loadFonts()).length});
        if(path==="/render"){
          const png=await renderProbe();
          return png?new Response(png,{headers:{"content-type":"image/png"}}):new Response("card rendering failed", {status:500});
        }
        const deps=createWatchDeps();
        const host=path==="/json"?"discordapp.com":"discord.com";
        const url="https://"+host+"/api/webhooks/"+(path==="/redirect"?"2":"1")+"/abcdefghijklmnopqrstuvwx";
        const files=path==="/file"?[{name:"watch-match.png",type:"image/png",data:await renderProbe()}]:undefined;
        const payload=files?buildAttachmentPayload({title:"offline probe",url:"https://example.test"},files[0]).payload:{embeds:[{title:"offline probe"}]};
        return Response.json({ok:await deps.sendWebhook(url,payload,files)});
      }};` },
    bundle: true, write: false, platform: "node", format: "esm",
    plugins: [{ name: "server-boundaries", setup(build) {
      build.onResolve({ filter: /^(?:@resvg\/resvg-wasm\/index_bg\.wasm|satori\/yoga\.wasm)$/ },
        ({ path }) => ({ path: path.startsWith("satori") ? "./layout.wasm" : "./resvg.wasm", external: true }));
      build.onResolve({ filter: /\.open-next\/worker\.js$/ }, () => ({ path: "app-worker", namespace: "fixture" }));
      build.onResolve({ filter: /^server-only$/ }, () => ({ path: "server", namespace: "fixture" }));
      build.onResolve({ filter: /^@opennextjs\/cloudflare$/ }, () => ({ path: "context", namespace: "fixture" }));
      build.onResolve({ filter: /^better-sqlite3$/ }, () => ({ path: "sqlite", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents:
        path === "app-worker" ? 'export default {fetch(){throw new Error("No app HTTP requests in render probe")}}' :
        path === "context" ? 'export function getCloudflareContext(){throw new Error("No DB in fetch-only probe")}' :
        path === "sqlite" ? 'export default class {constructor(){throw new Error("No SQLite in fetch-only probe")}}' : "",
      }));
    } }],
  });
  const calls = [];
  const font = fs.readFileSync(require.resolve("next/dist/compiled/@vercel/og/Geist-Regular.ttf"));
  const productionFonts = process.env.WATCH_TEST_PRODUCTION_FONTS === "1"
    ? JSON.parse(fs.readFileSync(".tmp/watch-font-production-manifest.json", "utf8")) : null;
  const wasm = fs.readFileSync(require.resolve("@resvg/resvg-wasm/index_bg.wasm"));
  const mf = new Miniflare(convertV4MiniflareOptions({
    modules: [
      { type: "ESModule", path: "probe.mjs", contents: bundle.outputFiles[0].text },
      { type: "CompiledWasm", path: "resvg.wasm", contents: wasm },
      { type: "CompiledWasm", path: "layout.wasm", contents: fs.readFileSync(require.resolve("satori/yoga.wasm")) },
    ],
    compatibilityDate: "2026-10-27", compatibilityFlags: ["nodejs_compat"],
    outboundService: async request => {
      const url = new URL(request.url);
      calls.push({ host: url.hostname, method: request.method, type: request.headers.get("content-type") });
      if (url.hostname === "discord.com") {
        assert.equal(request.method, "POST");
        if (request.headers.get("content-type")?.startsWith("multipart/form-data")) {
          const form = await request.formData();
          const file = form.get("files[0]");
          assert.ok(file && typeof file !== "string");
          const png = Buffer.from(await file.arrayBuffer());
          assert.ok(png.length > 1000, "attachment must be a rendered PNG, not a marker fixture");
          assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
          const payload = JSON.parse(form.get("payload_json"));
          assert.equal(payload.embeds[0].image.url, "attachment://watch-match.png");
          assert.equal(payload.attachments[0].filename, file.name);
        } else assert.ok((await request.arrayBuffer()).byteLength > 0);
        return url.pathname.includes("/2/")
          ? new Response(null, { status: 302, headers: { location: "https://untrusted.example/" } })
          : new Response(null, { status: 204 });
      }
      if (url.hostname === "media.valorant-api.com") {
        return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return new Response(productionFonts ? fs.readFileSync(".tmp/watch-font-production.css")
          : "@font-face {font-weight:400;src:url(https://fonts.gstatic.com/test.woff2)}");
      }
      if (url.hostname === "fonts.gstatic.com") {
        const entry = productionFonts?.find(f => f.url === request.url);
        if (productionFonts && !entry) throw new Error("Unapproved font fixture URL");
        return new Response(entry ? fs.readFileSync(entry.file) : font);
      }
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
    assert.ok(calls.filter(c => c.host === "discord.com")[1].type.startsWith("multipart/form-data"));
    assert.deepEqual(await read("/icon"), { data: "data:image/png;base64,iVBORw==" });
    assert.deepEqual(await read("/fonts"), { count: productionFonts ? 2 : 1 });
    const image = await mf.dispatchFetch("http://watch-probe.test/render");
    assert.equal(image.status, 200, image.status === 200 ? undefined : await image.text());
    const png = Buffer.from(await image.arrayBuffer());
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 880);
    assert.equal(png.readUInt32BE(20), 660);
    fs.mkdirSync(".tmp", { recursive: true });
    fs.writeFileSync(".tmp/watch-worker-card.png", png);
    assert.ok(!calls.some(c => c.host === "untrusted.example"));
    console.log("PASS: native workerd PNG rendering, JSON/multipart, assets and redirect rejection; no external messages/network");
  } finally { await mf.dispose(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
