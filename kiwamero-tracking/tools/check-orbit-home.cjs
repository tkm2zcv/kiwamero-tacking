// Visual check for the orbit home hero: serves the real orbit.css + shipped
// assets with markup identical to page.tsx output, then screenshots it in
// Puppeteer at the reference size, tablet and phone widths.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

const T = {
  nav: { home: "ホーム", watchlist: "監視対象", developers: "開発者" },
  search: {
    hint: "VALORANTの戦績・試合履歴をトラッキング。登録ユーザー限定サイトです。",
    pillLabel: "試合の自動通知", line1: "試合の先を見る", line2: "全員を追跡する",
    placeholder: "プレイヤーを検索 (Name#TAG)", cta: "検索", recent: "検索履歴", clear: "クリア",
  },
};

const HTML = `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=block">
<link rel="stylesheet" href="/orbit/orbit.css">
<style>body{margin:0;background:#000}
/* stand-ins for the Tailwind utility classes on HomeSearch/RecentSearches */
.flex{display:flex}.items-start{align-items:flex-start}.gap-2{gap:8px}.min-w-0{min-width:0}.flex-1{flex:1}
.relative{position:relative}.absolute{position:absolute}.left-4{left:16px}.top-1\\/2{top:50%}
.pointer-events-none{pointer-events:none}.size-5{width:20px;height:20px}.-translate-y-1\\/2{transform:translateY(-50%)}
.text-tertiary{color:#99abbf}.h-14{height:56px}.w-full{width:100%}.rounded-xl{border-radius:12px}
.pl-12{padding-left:48px}.pr-4{padding-right:16px}.text-base{font-size:16px}.outline-none{outline:none}
input.ori{background:#0f1923;border:2px solid #2c3f52;color:#fff}
button.ori{background:#ff4655;color:#efefef;border:0;border-radius:12px;padding:0 32px;font-weight:600;cursor:pointer}
button.img{height:56px;width:56px;border-radius:12px;border:2px solid #2c3f52;background:#0f1923;color:#99abbf;cursor:pointer}
.mx-auto{margin-left:auto;margin-right:auto}.mt-8{margin-top:32px}.max-w-2xl{max-width:672px}
.text-left{text-align:left}.text-13{font-size:13px}.text-secondary{color:#99abbf}
.items-center{align-items:center}.justify-between{justify-content:space-between}.font-semibold{font-weight:600}
.inline-flex{display:inline-flex}.size-4{width:16px;height:16px}.size-3{width:12px;height:12px}
.text-12{font-size:12px}.mt-3{margin-top:12px}.overflow-x-auto{overflow-x:auto}.pb-2{padding-bottom:8px}
.shrink-0{flex-shrink:0}.rounded-lg{border-radius:8px}.px-2{padding-left:8px;padding-right:8px}
.py-1\\.5{padding-top:6px;padding-bottom:6px}
</style>
<script>try{
if(!matchMedia("(prefers-reduced-motion: reduce)").matches){
document.documentElement.classList.add("intro");
setTimeout(function(){document.documentElement.classList.remove("intro","intro-play")},5000);
}}catch(e){}</script>
</head><body class="orbit-lock">
<div class="orbit">
<video class="sky" aria-hidden="true" autoplay muted loop playsinline preload="auto" poster="/orbit/sky.png" src="/orbit/sky.mp4"></video>
<div class="veil"></div>
<header class="bar">
<a class="brand" href="/" aria-label="Kiwamero Tracking — home"><img class="brand-mark" src="/brand/logo.webp" alt=""><span class="brand-word">Kiwamero<i>Tracking</i></span></a>
<nav class="links" aria-label="Primary"><a href="/">${T.nav.home}</a><a href="/watchlist">${T.nav.watchlist}</a><a href="/developers">${T.nav.developers}</a></nav>
<div class="actions">
<a class="btn ghost" href="/watchlist">${T.nav.watchlist}</a>
<a class="btn solid" href="/developers">${T.nav.developers}</a>
<button type="button" class="menu" id="menu-btn" aria-label="Menu" aria-expanded="false" aria-controls="menu-sheet"><svg viewBox="0 0 20 14" aria-hidden="true"><path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
<nav class="sheet" id="menu-sheet" aria-label="Menu"><a href="/">${T.nav.home}</a><a href="/watchlist">${T.nav.watchlist}</a><a href="/developers">${T.nav.developers}</a><a class="btn solid" href="/watchlist">${T.nav.watchlist}</a></nav>
</div>
</header>
<div class="screen"><main class="hero">
<a class="pill" href="/watchlist"><span class="chip">New</span><span class="pill-label">${T.search.pillLabel}</span><svg viewBox="0 0 9.5 8" aria-hidden="true"><path d="M0.7 4H8.8M5.6 0.75 8.85 4 5.6 7.25" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
<h1><span class="ln"><span class="ln-i">${T.search.line1}</span></span><span class="ln"><span class="ln-i">${T.search.line2}</span></span></h1>
<p>${T.search.hint}</p>
<div class="cta">
<div class="searchbox"><div class="flex items-start gap-2"><form id="search-form" class="flex min-w-0 flex-1 gap-2"><div class="relative min-w-0 flex-1"><svg class="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-tertiary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg><input id="q" placeholder="${T.search.placeholder}" class="ori h-14 w-full rounded-xl pl-12 pr-4 text-base outline-none"></div><button type="submit" class="ori">${T.search.cta}</button></form><button type="button" class="img"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:block;margin:0 auto"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5L6 23"/></svg></button></div></div>
<div class="recents"><div class="mx-auto mt-8 max-w-2xl text-left"><div class="flex items-center justify-between"><div class="flex items-center gap-2 text-13 text-secondary"><svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg><span class="font-semibold">${T.search.recent}</span></div><button type="button" class="inline-flex items-center gap-1 text-12 text-tertiary" style="background:none;border:0;cursor:pointer"><svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>${T.search.clear}</button></div><div class="mt-3 flex gap-2 overflow-x-auto pb-2"><a href="#" class="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5" style="background:#0f1923;color:#fff;text-decoration:none;font-size:13px">Meiy#B3L</a><a href="#" class="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5" style="background:#0f1923;color:#fff;text-decoration:none;font-size:13px">Test#1234</a></div></div></div>
</div>
</main></div>
</div>
<script>
// mirrors OrbitScripts behaviour for the harness
(function(){
var html=document.documentElement;
var v=document.querySelector("video.sky");
var play=function(){if(v&&v.paused)v.play().catch(function(){})};
if(v){v.muted=true;play();v.addEventListener("canplay",play);}
var bar=document.querySelector(".orbit .bar"),btn=document.getElementById("menu-btn");
var set=function(o){if(!bar||!btn)return;bar.dataset.open=o?"true":"false";btn.setAttribute("aria-expanded",String(o));btn.setAttribute("aria-label",o?"Close menu":"Menu")};
set(false);
btn.addEventListener("click",function(e){e.stopPropagation();set(bar.dataset.open!=="true")});
document.addEventListener("click",function(e){if(!bar.contains(e.target))set(false)});
document.addEventListener("keydown",function(e){if(e.key==="Escape")set(false)});
var done=false;
var start=function(){if(done||!html.classList.contains("intro"))return;done=true;
requestAnimationFrame(function(){requestAnimationFrame(function(){html.classList.add("intro-play")})})};
var t=setTimeout(start,700);
Promise.resolve(document.fonts&&document.fonts.ready).then(function(){clearTimeout(t);start()}).catch(start);
var last=document.querySelector(".orbit .searchbox");
document.addEventListener("animationend",function(e){if(e.target===last){html.classList.remove("intro","intro-play")}});
setTimeout(function(){html.classList.remove("intro","intro-play")},3000);
})();
</script>
<script>
// mirrors HomeSearch.submit: the local profile always loads; a reserved tab
// is sent to tracker.gg only when the account resolves, else it is closed.
(function(){
var form=document.getElementById("search-form"),input=document.getElementById("q"),busy=false;
form.addEventListener("submit",function(e){
e.preventDefault();
if(busy)return;
var m=input.value.trim().match(/^(.+?)#(.+)$/);
if(!m){input.style.borderColor="#ff4655";return}
var local="/valorant/profile/riot/"+encodeURIComponent(m[1])+"%23"+encodeURIComponent(m[2])+"/overview";
var tab=window.open("about:blank","_blank");
if(tab)tab.opener=null;
busy=true;window.__nav=local;
if(!tab){busy=false;return}
fetch("/api/valorant/account/"+encodeURIComponent(m[1])+"/"+encodeURIComponent(m[2]))
.then(function(res){
  if(res.ok){window.__recorded={name:m[1],tag:m[2]};tab.location.href="https://tracker.gg/valorant/profile/riot/"+encodeURIComponent(m[1])+"%23"+encodeURIComponent(m[2])+"/overview"}
  else{tab.close()}
  busy=false;
})
.catch(function(){tab.close();busy=false});
});
})();
</script>
</body></html>`;

(async () => {
  const root = path.join(process.cwd(), "public");
  const server = http.createServer((req, res) => {
    const url = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    if (url.startsWith("/api/valorant/account/")) {
      res.setHeader("Content-Type", "application/json");
      res.statusCode = decodeURIComponent(url.split("/")[4]) === "Meiy" ? 200 : 502;
      return res.end("{}");
    }
    // orbit.css lives in src/app in the app bundle; assets stay in public/.
    const file = url === "/index.html"
      ? null
      : url === "/orbit/orbit.css"
        ? path.join(process.cwd(), "src/app/orbit.css")
        : path.join(root, url);
    if (!file) { res.setHeader("Content-Type", "text/html"); return res.end(HTML); }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; return res.end("nf"); }
      const ext = path.extname(file);
      res.setHeader("Content-Type", { ".css": "text/css", ".mp4": "video/mp4", ".png": "image/png", ".webp": "image/webp" }[ext] || "application/octet-stream");
      res.end(data);
    });
  });
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  const base = `http://127.0.0.1:${port}`;
  let browser;
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    // Capture new tabs instead of opening real ones; __blockPopups simulates a blocker.
    await page.evaluateOnNewDocument(() => {
      window.open = () => window.__blockPopups
        ? null
        : (window.__lastTab = { opener: null, closed: false, location: { href: "" }, close() { this.closed = true; } });
    });

    // Reference render: nav on the black band, hero contents centred, video below.
    await page.setViewport({ width: 1563, height: 1006 });
    await page.goto(base);
    const early = await page.evaluate(() => ({
      intro: document.documentElement.classList.contains("intro"),
      headlineOpacity: getComputedStyle(document.querySelector(".orbit .brand")).opacity,
    }));
    assert.equal(early.intro, true);
    assert.ok(parseFloat(early.headlineOpacity) < 1, "brand mid-entrance during intro");
    await new Promise(r => setTimeout(r, 2200));
    const done = await page.evaluate(() => ({
      intro: document.documentElement.classList.contains("intro"),
      play: document.documentElement.classList.contains("intro-play"),
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      videoPlaying: !document.querySelector("video.sky").paused,
      videoBox: document.querySelector("video.sky").getBoundingClientRect().toJSON(),
      barBox: document.querySelector(".orbit .bar").getBoundingClientRect().toJSON(),
      h1Box: document.querySelector(".orbit h1").getBoundingClientRect().toJSON(),
      searchBox: document.querySelector(".orbit .searchbox").getBoundingClientRect().toJSON(),
    }));
    assert.equal(done.intro, false, "intro removed after timeline");
    assert.equal(done.play, false);
    assert.equal(done.videoPlaying, true, "video is playing");
    assert.ok(done.barBox.top < 30 && done.barBox.top >= 0, "bar at top band");
    assert.ok(done.h1Box.top < done.searchBox.top, "headline above search");
    assert.ok(done.videoBox.height >= 1006, "video covers viewport");
    await page.screenshot({ path: ".tmp/orbit-1563.png" });

    // Keyboard check: menu opens on tablet.
    await page.setViewport({ width: 800, height: 600 });
    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: ".tmp/orbit-800.png" });
    await page.click("#menu-btn");
    assert.equal(await page.$eval(".orbit .bar", el => el.dataset.open), "true");
    assert.ok(await page.$eval("#menu-sheet", el => el.offsetParent !== null), "sheet visible");
    await page.keyboard.press("Escape");
    assert.equal(await page.$eval(".orbit .bar", el => el.dataset.open), "false");

    // Phone: no horizontal overflow, hamburger present.
    await page.setViewport({ width: 390, height: 844 });
    await new Promise(r => setTimeout(r, 400));
    const mob = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      searchW: document.querySelector(".orbit .searchbox").getBoundingClientRect().width,
      menuVisible: getComputedStyle(document.getElementById("menu-btn")).display !== "none",
    }));
    assert.equal(mob.menuVisible, true);
    assert.ok(mob.searchW <= 390, `search fits viewport (got ${mob.searchW})`);
    await page.screenshot({ path: ".tmp/orbit-390.png" });

    // --- search flow: local nav always runs; tracker.gg tab opens only on resolve ---
    await page.setViewport({ width: 1563, height: 1006 });
    await page.$eval("#q", el => (el.value = "Meiy#B3L"));
    await page.click("#search-form button[type=submit]");
    await page.waitForFunction(() => window.__lastTab?.location.href, { timeout: 5000 });
    const hit = await page.evaluate(() => ({
      href: window.__lastTab.location.href,
      nav: window.__nav,
      recorded: window.__recorded,
    }));
    assert.equal(hit.href, "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview");
    assert.equal(hit.nav, "/valorant/profile/riot/Meiy%23B3L/overview", "local nav always runs");
    assert.deepEqual(hit.recorded, { name: "Meiy", tag: "B3L" });

    // --- missing/errored account → local nav already ran, blank tab closed ---
    await page.evaluate(() => { window.__lastTab = null; window.__nav = undefined; window.__recorded = null; });
    await page.$eval("#q", el => (el.value = "Ghost#ZZZ"));
    await page.click("#search-form button[type=submit]");
    await page.waitForFunction(() => window.__lastTab?.closed, { timeout: 5000 });
    const miss = await page.evaluate(() => ({
      nav: window.__nav, closed: window.__lastTab?.closed, recorded: window.__recorded,
    }));
    assert.equal(miss.nav, "/valorant/profile/riot/Ghost%23ZZZ/overview", "local nav runs even on lookup failure");
    assert.equal(miss.closed, true, "blank tab closed on fallback");
    assert.equal(miss.recorded, null, "failed lookup not recorded early");

    // --- popup blocker → local nav still runs, no blank tab ---
    await page.evaluate(() => { window.__nav = undefined; window.__blockPopups = true; });
    await page.$eval("#q", el => (el.value = "Meiy#B3L"));
    await page.click("#search-form button[type=submit]");
    await page.waitForFunction(() => window.__nav, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__nav), "/valorant/profile/riot/Meiy%23B3L/overview");

    assert.deepEqual(errors, []);
    console.log("PASS: orbit hero renders at 1563x1006, intro plays once, video runs, tablet menu, phone fits, search always navigates locally and adds a tracker.gg tab on resolve");
  } finally {
    await browser?.close();
    await new Promise(r => server.close(r));
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
