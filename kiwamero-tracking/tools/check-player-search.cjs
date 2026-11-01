// Offline browser check of the real forms, parser and history recorder.
const assert = require("node:assert/strict");
const http = require("node:http");
const esbuild = require("esbuild");
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

(async () => {
  const root = process.cwd();
  const built = await esbuild.build({
    stdin: { contents: `
      import React from "react"; import {createRoot} from "react-dom/client";
      import {HomeSearch} from "./src/components/home-search";
      import {NavSearch} from "./src/components/nav-search";
      import {ProfileViewRecorder} from "./src/components/profile/profile-view-recorder";
      import {getSearchHistory} from "./src/lib/search-history";
      import {dicts} from "./src/lib/i18n/dict";
      window.routes=[]; window.popups=[]; window.getHistory=getSearchHistory;
      window.open=()=>{const tab={opener:null,location:{href:""},close(){this.closed=true}};
        window.popups.push(tab);return tab;};
      const t=dicts.ja.search;
      createRoot(document.getElementById("home")).render(<HomeSearch placeholder={t.placeholder} cta={t.cta} imageSearch={t}/>);
      createRoot(document.getElementById("nav")).render(<NavSearch placeholder={t.placeholder}/>);
      const recorder=createRoot(document.getElementById("recorder"));
      window.recordProfile=(name,tag,puuid)=>recorder.render(<ProfileViewRecorder name={name} tag={tag} puuid={puuid}/>);`,
      loader: "tsx", resolveDir: root },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{ name: "router-boundary", setup(build) {
      build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
        contents: "export const useRouter=()=>({push:path=>window.routes.push(path)});",
      }));
    } }],
  });
  let accountRequests = 0;
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") {
      res.setHeader("Content-Type", "text/javascript"); return res.end(built.outputFiles[0].text);
    }
    if (req.url.startsWith("/api/valorant/account/")) {
      accountRequests++;
      res.setHeader("Content-Type", "application/json"); return res.end('{"status":200}');
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><div id="home"></div><div id="nav"></div><div id="recorder"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--disable-background-networking"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", req => req.url().startsWith("http://127.0.0.1") ? req.continue() : req.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector("#home input");
    const id = "4172c23f-8c2e-5c68-9afb-2ea38c5e2028";
    const path = `/valorant/profile/riot/${id}/overview`;
    await page.type("#home input", id.toUpperCase());
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.routes.length === 1);
    assert.equal(await page.evaluate(() => window.routes[0]), path);
    assert.equal(await page.evaluate(() => window.popups.length), 0);
    assert.equal(accountRequests, 0, "PUUID has no extra client-side account fetch");
    assert.equal(await page.evaluate(() => window.getHistory().length), 0);
    await page.evaluate(id => window.recordProfile("Current Player", "TAG", id), id);
    await page.waitForFunction(() => window.getHistory().length === 1);
    assert.equal(await page.evaluate(() => window.getHistory()[0].name), "Current Player");
    await page.evaluate(id => window.recordProfile("Renamed", "TAG", id), id);
    await page.waitForFunction(() => window.getHistory()[0].name === "Current Player");
    await page.type("#nav input", id);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.routes.length === 2);
    assert.equal(await page.evaluate(() => window.routes[1]), path);
    await page.setViewport({ width: 393, height: 852 });
    await page.click("#home input", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#home input", "incomplete-id");
    await page.keyboard.press("Enter");
    await page.waitForSelector('#home input[aria-invalid="true"]');
    assert.equal(await page.evaluate(() => window.routes.length), 2);
    await page.click("#home input", { clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.type("#home input", "Existing Player#TAG");
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.routes.length === 3 && window.popups[0]?.location.href.includes("tracker.gg"));
    assert.equal(await page.evaluate(() => window.routes[2]), "/valorant/profile/riot/Existing%20Player%23TAG/overview");
    assert.equal(accountRequests, 1, "existing Riot ID popup verification remains intact");
    assert.deepEqual(errors, []);
    console.log("PASS: real home/nav PUUID search, resolved-name history, invalid input/mobile, and existing Riot ID popup flow");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
