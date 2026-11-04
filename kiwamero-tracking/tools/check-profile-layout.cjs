// Actual profile cards and production CSS, with local data only.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const esbuild = require("esbuild");
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

(async () => {
  const root = process.cwd();
  const ui = await esbuild.build({
    stdin: { resolveDir: root, loader: "tsx", contents: `
      import React from "react"; import {createRoot} from "react-dom/client";
      import {PerformanceTable} from "./src/components/profile/performance-table";
      import {BestMatchesCard} from "./src/components/profile/best-matches-card";
      import {stored} from "./tests/history-fixtures";
      import {aggregate,groupBySeason} from "./src/lib/stored-stats";
      import {encounterCoverageText} from "./src/lib/encounter-coverage";
      import {AuditBoundary} from "./src/components/profile/audit-boundary";
      import {ReportMethod} from "./src/components/profile/report-ui";
      import {buildAccountReport} from "./src/lib/account-report";
      const baselineRows=Array.from({length:80},(_,i)=>stored(i,{
        startedAt:Date.parse(i<40?"2023-10-01":"2026-10-23")/1000+(i%40)*8640,
        seasonShort:i<40?"e7a3":"e11a6",tier:i<40?18:10,
        kills:i<40?20:17,deaths:18,cluster:i<40?"Hong Kong":"Tokyo"}));
      const baseline=(locale)=>buildAccountReport({profile:{puuid:"fixture",name:"Fixture",tag:"TAG",
        level:300,region:"ap",currentTier:10,currentRank:"Silver 2"},storedAll:baselineRows,
        seasons:[{actCode:"e7a3",peakTier:24,games:126,wins:73}],rosterMatches:[],
        locale,generatedAt:"2026-10-30T00:00:00Z"});
      const rows=Array.from({length:24},(_,i)=>stored(i+1,{seasonId:"act"+i,seasonShort:"e11a"+(i+1)}));
      const acts=rows.map((r,i)=>({label:"V26: A"+(i+1),href:"#act"+i}));
      createRoot(document.getElementById("root")).render(
        <main className="kt-container">
          <p role="status">{encounterCoverageText("ja",{covered:48,total:54,allActs:true,recentTotal:50,
            recentCovered:48,pending:2,olderMissing:4,unavailable:0,blocked:false,loaded:true})}</p>
          <div className="kt-columns">
            <aside className="kt-sidebar"><BestMatchesCard rows={rows.slice(0,5)} now={Date.now()/1000}/></aside>
            <section className="kt-maincol"><PerformanceTable seasons={groupBySeason(rows)}
              lifetime={{stats:aggregate(rows)}} ranks={[]} actItems={acts}/></section>
          </div>
          {["ja","en"].map(locale=><section className="kt-report" data-baseline={locale} key={locale}>
            <AuditBoundary report={baseline(locale)}/><ReportMethod locale={locale}/>
          </section>)}
        </main>);
    ` },
    // CSS is served from the real compiled styles below, not from the JS probe.
    bundle: true, write: false, platform: "browser", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "offline-next-elements", setup(build) {
      build.onResolve({ filter: /^next\/(image|link)$/ }, ({ path }) => ({ path, namespace: "fixture" }));
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        loader: "jsx", resolveDir: root, contents: path === "next/image"
          ? 'import React from "react"; export default function Image({src,...props}){return <img {...props}/>;}'
          : 'import React from "react"; export default function Link(p){return <a {...p}/>;}',
      }));
    } }],
  });
  const chunks = path.join(root, ".next/static/chunks");
  const utilities = fs.readdirSync(chunks).filter(f => f.endsWith(".css")).map(f =>
    fs.readFileSync(path.join(chunks, f), "utf8")).join("\n");
  assert.match(utilities, /\.kt-report-card[\s,{:]/, "compiled audit CSS must be present");
  // Reapply local rules so the probe can reproduce a CSS fix before a new build.
  const css = utilities + (process.env.PROFILE_LAYOUT_BUILT ? "" : "\n" +
    ["globals.css", "tracker-ui.css", "trn-v3.css"].map(f =>
      fs.readFileSync(path.join(root, "src/app", f), "utf8").replace('@import "tailwindcss";', "")).join("\n"));
  const server = http.createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript"); return res.end(ui.outputFiles[0].text); }
    if (req.url === "/style.css") { res.setHeader("Content-Type", "text/css"); return res.end(css); }
    res.setHeader("Content-Type", "text/html");
    res.end('<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--disable-background-networking"] });
    const page = await browser.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on("request", r => r.url().startsWith("http://127.0.0.1:") ? r.continue() : r.abort());
    for (const width of [1440, 1024, 375]) {
      await page.setViewport({ width, height: 900 });
      await page.goto(`http://127.0.0.1:${server.address().port}`);
      await page.waitForSelector(".performance");
      assert.match(await page.$eval('[role="status"]', e => e.textContent), /54試合中.*48試合/);
      const ja = await page.$eval('[data-baseline="ja"]', e => e.textContent);
      const en = await page.$eval('[data-baseline="en"]', e => e.textContent);
      assert.match(ja, /ACT全体126試合/);
      assert.match(ja, /現在40試合/);
      assert.match(ja, /変化した日時/);
      assert.match(en, /126 total ACT games, not games all played at that peak/);
      assert.match(en, /Change dates and coincidence are not established/);
      assert.equal(await page.$$eval("[data-baseline]", els =>
        els.every(e => e.scrollWidth <= e.clientWidth + 1)), true, `audit overflow at ${width}px`);
      const bars = await page.$$eval(".performance > .v3-card__filters, .best-matches > .v3-card__filters",
        els => els.map(e => {
          e.scrollTop = 20; e.scrollLeft = 20;
          return { x: getComputedStyle(e).overflowX, y: getComputedStyle(e).overflowY, top: e.scrollTop, left: e.scrollLeft };
        }));
      assert.deepEqual(bars, Array(2).fill({ x: "visible", y: "visible", top: 0, left: 0 }), `filter scroll at ${width}px`);
      assert.equal(await page.$eval(".performance", e => getComputedStyle(e).overflowX), "visible");
      assert.deepEqual(await page.$eval(".performance-content-wrapper", e => ({
        x: getComputedStyle(e).overflowX, y: getComputedStyle(e).overflowY,
      })), { x: "auto", y: "hidden" }, "only the table may scroll horizontally");
      const trigger = ".performance .v3-filter";
      await page.click(trigger);
      await page.waitForSelector(".performance .kt-menu-panel a");
      assert.equal(await page.$eval(".performance .kt-menu-panel a", e => {
        const r=e.getBoundingClientRect();
        return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      }), true, `ACT menu clipped at ${width}px`);
      await page.keyboard.press("Escape");
      assert.equal(await page.$( ".performance .kt-menu-panel"), null);
      if (process.env.PROFILE_LAYOUT_SCREENSHOT_DIR && width === 1440) {
        await page.screenshot({ path: path.join(process.env.PROFILE_LAYOUT_SCREENSHOT_DIR, "profile-controls-desktop.png"), fullPage: true });
      }
    }
    assert.deepEqual(errors, []);
    console.log("PASS: JA/EN longitudinal evidence and honest ACT/timing copy; no overflow at1440/1024/375px; Japanese encounter coverage, filter scrolling and ACT menus; no external calls");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
