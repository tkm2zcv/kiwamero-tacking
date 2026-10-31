const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const Module = require("node:module");
const esbuild = require("esbuild");
// Optional browser tooling, like check-image-search.cjs; never an application dependency.
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

(async () => {
  const root = process.cwd();
  const { rawMatch, selfId } = await import(pathToFileURL(path.join(root, "tests/history-fixtures.ts")));
  const valid = rawMatch(1);
  const broken = [null, { metadata: null, players: null, teams: null },
    { ...valid, metadata: { ...valid.metadata, map: null } },
    { ...valid, players: [{ ...valid.players[0], stats: null }] }];
  globalThis.__profileAccount = {
    name: "Fixture Player", tag: "TAG", puuid: selfId, region: "ap",
    account_level: 100, card: { id: "" }, last_update: "",
  };
  const build = await esbuild.build({
    stdin: { contents: 'export {loadProfile} from "./src/lib/data";', resolveDir: root },
    bundle: true, write: false, platform: "node", format: "cjs",
    plugins: [{
      name: "offline-profile-sources",
      setup(build) {
        build.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "fixture" }));
        build.onResolve({ filter: /^\.\/henrikdev(\.ts)?$/ }, () => ({ path: "provider", namespace: "fixture" }));
        // The fixture bundle never needs the real HTTP layer; remapping it to the
        // error class keeps every HenrikDevError instanceof check on one class.
        build.onResolve({ filter: /^\.\/henrik-client\.ts$/ },
          () => ({ path: path.join(root, "src/lib/henrik-errors.ts") }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({ contents: path === "empty" ? "" : `
          export const getAccount = async () => globalThis.__profileAccount;
          export const getMmr = async () => ({});
          export const getMmrHistory = async () => [];
          export const getStoredMatches = async () => [];
          export const getMatches = async () => globalThis.__profileMatches;
          export const tierIcon = () => "";` }));
      },
    }],
  });
  assert.ok(!build.outputFiles[0].text.includes("api.henrikdev.xyz"),
    "fixture bundle must not contain the real upstream client");
  const fixtureModule = new Module(path.join(root, ".tmp/profile-loading-fixture.cjs"), module);
  fixtureModule.paths = module.paths;
  fixtureModule._compile(build.outputFiles[0].text, fixtureModule.id);
  const { loadProfile } = fixtureModule.exports;
  for (const rows of [[valid, ...broken], broken, []]) {
    globalThis.__profileMatches = rows;
    const result = await loadProfile("Fixture Player", "TAG");
    assert.equal(result.ok, true);
    const expected = rows.includes(valid) ? 1 : 0;
    assert.equal(result.bundle.source, "henrikdev");
    assert.equal(result.bundle.profile.name, "Fixture Player");
    assert.equal(result.bundle.matches.length, expected);
    assert.equal(result.bundle.summary.matches, expected);
    assert.equal(result.bundle.summary.kills, expected ? 12 : 0);
    assert.equal(result.bundle.unavailableRecentMatches ?? 0, rows.filter(row => row !== valid).length);
  }
  globalThis.__profileMatches = { invalid: "list container" };
  assert.deepEqual(await loadProfile("Fixture Player", "TAG"), { ok: false, reason: "upstream" });
  console.log("PASS: real loadProfile pipeline; mixed/null/all-unavailable/empty histories; honest counts; no upstream calls");

  const ui = await esbuild.build({
    stdin: { contents: `
      import React from "react"; import {createRoot} from "react-dom/client";
      import ProfileError from "./src/app/valorant/profile/riot/[id]/[[...tab]]/error";
      import {I18nProvider} from "./src/lib/i18n/client"; import {dicts} from "./src/lib/i18n/dict";
      const root = createRoot(document.getElementById("root")); window.retries = 0;
      window.showError = (locale) => root.render(<I18nProvider locale={locale} dict={dicts[locale]}>
        <ProfileError error={new Error("provider-secret-must-not-appear")} retry={()=>window.retries++}/>
      </I18nProvider>); window.showError("ja");`, loader: "tsx", resolveDir: root },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    plugins: [{
      name: "browser-link",
      setup(build) {
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: 'import React from "react"; export default function Link(p){return React.createElement("a",p,p.children);}',
          resolveDir: root,
        }));
      },
    }],
  });
  const css = fs.readFileSync("node_modules/tailwindcss/preflight.css", "utf8") +
    fs.readFileSync("src/app/globals.css", "utf8").replace('@import "tailwindcss";', "") +
    fs.readFileSync("src/app/tracker-ui.css", "utf8");
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(ui.outputFiles[0].text); }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--disable-background-networking"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.waitForSelector('[role="alert"]');
    assert.match(await page.$eval("h1", el => el.textContent), /プロフィール/);
    assert.ok(!(await page.$eval("body", el => el.textContent)).includes("provider-secret"));
    await page.focus("button"); await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.retries), 1);
    assert.equal(await page.$eval("a", el => el.getAttribute("href")), "/");
    await page.setViewport({ width: 375, height: 600 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.evaluate(() => window.showError("en"));
    await page.waitForFunction(() => document.querySelector("h1").textContent.includes("profile"));
    assert.deepEqual(errors, []);
    console.log("PASS: real profile error fallback, localized copy, keyboard retry, search link, mobile, sanitized errors");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
    delete globalThis.__profileAccount; delete globalThis.__profileMatches;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
