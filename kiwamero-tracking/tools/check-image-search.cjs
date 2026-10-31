const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const esbuild = require("esbuild");
// Optional browser tooling; never part of the production bundle or mandatory unit suite.
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

(async () => {
  const root = process.cwd();
  const fixture = process.env.IMAGE_SEARCH_FIXTURE;
  if (!fixture || !fs.existsSync(fixture)) throw new Error("Set IMAGE_SEARCH_FIXTURE to a local name-tooltip screenshot.");
  const expected = process.env.IMAGE_SEARCH_EXPECTED;
  const assetRequests = [];
  let failOcr = false;
  let bundle = "";
  const styles = fs.readFileSync("src/app/globals.css", "utf8").replace('@import "tailwindcss";', "") +
    fs.readFileSync("src/app/tracker-ui.css", "utf8") +
    ".flex{display:flex}.items-center{align-items:center}.justify-between{justify-content:space-between}" +
    ".hidden{display:none}.size-5{width:20px;height:20px}.text-secondary{color:#99abbf}.font-bold{font-weight:700}" +
    ".h-14{height:56px}.w-14{width:56px}.flex-1{flex:1}.min-w-0{min-width:0}.gap-2{gap:8px}.mt-4{margin-top:16px}";
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, "http://localhost").pathname;
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:");
    let file;
    if (pathname === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(bundle); }
    if (pathname === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(styles); }
    if (pathname.startsWith("/ocr/")) {
      if (failOcr && pathname.endsWith("/assets.json")) { res.writeHead(503); return res.end(); }
      const publicRoot = path.join(root, "public");
      const candidate = path.resolve(publicRoot, "." + pathname);
      if (candidate.startsWith(publicRoot + path.sep) && fs.existsSync(candidate)) file = candidate;
      if (!file) { res.writeHead(404); return res.end(); }
      assetRequests.push(pathname);
    }
    if (file) {
      res.setHeader("Content-Length", fs.statSync(file).size);
      res.setHeader("Content-Type", pathname.endsWith(".js") ? "text/javascript" : pathname.endsWith(".wasm") ? "application/wasm" : "application/octet-stream");
      return fs.createReadStream(file).pipe(res);
    }
    res.setHeader("Content-Type", "text/html");
    res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><main id="root"></main><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    const built = await esbuild.build({
      stdin: { contents: `
        import React from "react"; import {createRoot} from "react-dom/client";
        import {HomeSearch} from "./src/components/home-search";
        import {dicts} from "./src/lib/i18n/dict";
        window.routes=[]; const t=dicts.ja.search;
        createRoot(document.getElementById("root")).render(<React.StrictMode><HomeSearch placeholder={t.placeholder} cta={t.cta} imageSearch={t}/></React.StrictMode>);`,
        resolveDir: root, loader: "tsx" },
      bundle: true, write: false, platform: "browser", jsx: "automatic",
      plugins: [{
        name: "local-test-adapters",
        setup(build) {
          build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "router", namespace: "fixture" }));
          build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const useRouter=()=>({push:(path)=>window.routes.push(path)});" }));
        },
      }],
    });
    bundle = built.outputFiles[0].text;
    browser = await puppeteer.launch({ headless: true, args: ["--disable-background-networking", "--disable-component-update"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.setViewport({ width: 1100, height: 900 });
    await page.goto(origin);
    await page.waitForSelector('[aria-haspopup="dialog"]');
    await page.type('input[placeholder="プレイヤーを検索 (Name#TAG)"]', "Previous#OLD");
    await page.focus('[aria-haspopup="dialog"]');
    await page.keyboard.press("Enter");
    await page.waitForSelector("dialog[open]");
    assert.equal(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)), true);
    await page.focus(".kt-image-drop");
    const picker = page.waitForFileChooser();
    await page.keyboard.press("Enter");
    await (await picker).accept([fixture]);
    await page.waitForSelector(".kt-image-preview canvas");
    const crop = await page.$$eval('input[type="range"]', els => els.map(el => ({ label: el.parentElement.textContent, value: el.value })));
    console.log("suggested crop:", JSON.stringify(crop));
    await page.click(".kt-image-panel > button.trn-button");
    await page.waitForSelector("#image-search-id", { timeout: 90000 });
    console.log("real OCR candidates:", await page.$$eval(".kt-image-candidates button", els => els.map(el => el.textContent)));
    console.log("real OCR initial edit:", await page.$eval("#image-search-id", el => el.value));
    if (expected) assert.equal(await page.$eval("#image-search-id", el => el.value), expected, "OCR must preserve the exact ID including legitimate spaces");
    assert.ok(await page.evaluate(() => caches.keys().then(keys => keys.some(key => key.startsWith("kiwamero-paddle-")))));
    assert.deepEqual(await page.evaluate(() => window.routes), []);
    const candidates = await page.$$(".kt-image-candidates button");
    if (candidates.length) await candidates[0].click();
    assert.deepEqual(await page.evaluate(() => window.routes), [], "candidate selection must not search");
    await page.$eval("#image-search-id", el => { el.value = ""; el.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.focus("#image-search-id");
    await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control");
    await page.type("#image-search-id", "Player#日本語");
    const compositionPrevented = await page.$eval("#image-search-id", el => {
      const event = new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true, cancelable: true });
      el.dispatchEvent(event); return event.defaultPrevented;
    });
    assert.equal(compositionPrevented, true);
    assert.deepEqual(await page.evaluate(() => window.routes), []);
    for (let i = 0; i < 25; i++) {
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => !document.activeElement || document.activeElement === document.body ||
        document.querySelector("dialog").contains(document.activeElement)), true, "focus must not reach the search behind the modal");
    }
    await page.focus("#image-search-id"); await page.keyboard.press("Enter");
    await page.waitForFunction(() => window.routes.length === 1);
    assert.deepEqual(await page.evaluate(() => window.routes), ["/valorant/profile/riot/Player%23%E6%97%A5%E6%9C%AC%E8%AA%9E/overview"]);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-haspopup")), "dialog");
    await page.click('[aria-haspopup="dialog"]'); await page.keyboard.press("Escape");
    assert.equal(await page.$("dialog"), null);
    await page.click('[aria-haspopup="dialog"]');
    const input = await page.$('input[type="file"]');
    await input.uploadFile(fixture);
    await page.waitForSelector(".kt-image-preview");
    await page.click(".kt-image-panel > button.trn-button");
    await page.waitForSelector("#image-search-id", { timeout: 90000 });
    if (expected) assert.equal(await page.$eval("#image-search-id", el => el.value), expected);
    await page.setViewport({ width: 375, height: 600 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    const panel = await page.$eval("dialog", el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, viewport: innerHeight }));
    assert.ok(panel.height <= panel.viewport);
    await page.click(".kt-image-panel > button.trn-button");
    await page.waitForSelector('[role="status"]');
    await page.keyboard.press("Escape");
    await page.click('[aria-haspopup="dialog"]');
    await new Promise(resolve => setTimeout(resolve, 1500));
    assert.equal(await page.$("#image-search-id"), null, "cancelled results must not reappear after reopen");
    await (await page.$('input[type="file"]')).uploadFile(fixture);
    await page.waitForSelector(".kt-image-preview");
    failOcr = true;
    await page.click(".kt-image-panel > button.trn-button");
    await page.waitForSelector('[role="alert"]', { timeout: 90000 });
    assert.ok(await page.$("#image-search-id"), "manual search remains available after model failure");
    failOcr = false;
    await page.click(".kt-image-panel > button.trn-button");
    await page.waitForSelector("#image-search-id", { timeout: 90000 });
    if (expected) assert.equal(await page.$eval("#image-search-id", el => el.value), expected);
    assert.equal(errors.length, 0, errors.join("\n"));
    for (const suffix of ["/small_det.onnx", "/small_rec.onnx", "/pure_onnx_ocr_wasm_bg.wasm"]) {
      assert.equal(assetRequests.filter(url => url.endsWith(suffix)).length, 1, "runtime/models should be reused from browser cache");
    }
    console.log("PASS: PaddleOCR, exact name spaces, cache, download failure/retry, keyboard upload, candidate confirmation, unicode route, Enter, IME, focus, Escape, mobile, cancellation");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(err => { console.error(err); process.exitCode = 1; });
