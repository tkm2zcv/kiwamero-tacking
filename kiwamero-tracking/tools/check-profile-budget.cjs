// Offline integration check: real page/data/HTTP/quota code, controlled upstream
// latency, and a real browser. No production credentials or upstream calls.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const Module = require("node:module");
const { pathToFileURL } = require("node:url");
const esbuild = require("esbuild");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const puppeteer = require(process.env.PUPPETEER_MODULE || "puppeteer");

(async () => {
  const root = process.cwd();
  const { rawMatch, selfId } = await import(pathToFileURL(path.join(root, "tests/history-fixtures.ts")));
  const stubs = {
    "server-only": "",
    "@/lib/site-access": `export const getSiteAccess = async () => {
      if(globalThis.__accessDelay) await new Promise(r => setTimeout(r, globalThis.__accessDelay));
      return {status: globalThis.__denied ? 'denied' : globalThis.__allowed ? 'allowed' : 'anonymous'}; };`,
    "@/lib/auth-client": "export const useSession = () => ({data:null,isPending:false}); export const signIn = {}; export const signOut = async () => {};",
    "next/server": "export const after = (task) => globalThis.__after.push(task);",
    "next/headers": `export const headers = async () => new Headers({
      ...(globalThis.__fetchMetadata ?? {'sec-fetch-site':'same-origin'}),'accept-language':'ja'});
      export const cookies = async () => ({get:()=>undefined});`,
    "next/navigation": `export const useRouter = () => ({refresh(){},push(){},replace(){}});
      export const usePathname = () => '/valorant/profile/riot/Budget%20Player%23TAG';
      export const useSearchParams = () => new URLSearchParams();
      export const notFound = () => {throw new Error('not found');};`,
    "next/link": `import React from 'react'; export default function Link({prefetch,...props}){return React.createElement('a',props);}`,
    "next/image": `import React from 'react'; export default function Image({fill,priority,unoptimized,...props}){return React.createElement('img',props);}`,
  };
  const build = await esbuild.build({
    stdin: { contents: `
      export {default as Page} from "./src/app/valorant/profile/riot/[id]/[[...tab]]/page";
      export {I18nProvider} from "./src/lib/i18n/client"; export {dicts} from "./src/lib/i18n/dict";
      export {execute,queryAll} from "./src/lib/db"; export {resetHenrikClient} from "./src/lib/henrik-client";
      export * from "./src/lib/profile-cache";`, resolveDir: root },
    bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".css": "empty" },
    external: ["react", "react-dom", "better-sqlite3", "@opennextjs/cloudflare"],
    plugins: [{ name: "request-fixtures", setup(build) {
      build.onResolve({ filter: /.*/ }, ({ path: name }) =>
        Object.hasOwn(stubs, name) ? { path: name, namespace: "fixture" } : undefined);
      build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path: name }) =>
        ({ contents: stubs[name], resolveDir: root }));
    } }],
  });
  const fixture = new Module(path.join(root, ".tmp/profile-budget-fixture.cjs"), module);
  fixture.paths = module.paths;
  fixture._compile(build.outputFiles[0].text, fixture.id);
  const app = fixture.exports;
  process.env.DATABASE_URL = "file::memory:";
  process.env.HENRIK_API_KEYS = "offline-budget-key";
  delete process.env.HENRIK_API_KEY;
  for (const sql of fs.readFileSync("db/schema.sql", "utf8").split(";").filter((s) => s.trim())) await app.execute(sql);
  const account = { name: "Budget Player", tag: "TAG", puuid: selfId, region: "ap", account_level: 100, card: {}, last_update: "" };
  const match = rawMatch(1);
  let scenario = "fast", calls = 0;
  const requested = [];
  const pending = [];
  const realFetch = globalThis.fetch;
  globalThis.__allowed = true;
  globalThis.__after = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    assert.ok(url.startsWith("https://api.henrikdev.xyz/"), "unexpected external fetch");
    calls++;
    requested.push(url);
    if (scenario === "private") return new Response(null, { status: 403 });
    if ((scenario === "identity" && url.includes("/account/")) ||
        (scenario === "all" && !url.includes("/account/")) ||
        (scenario === "optional" && url.includes("/mmr-history/"))) {
      await new Promise((resolve) => pending.push(resolve));
    }
    let data = [];
    if (url.includes("/account/")) data = account;
    else if (url.includes("/mmr/")) data = { current_data: { currenttier: 12, currenttierpatched: "Gold 1", ranking_in_tier: 50 } };
    else if (url.includes("/matches/")) data = [match];
    else if (url.includes("/stored-matches/")) data = [{
      meta: { id: match.metadata.matchid, map: { name: "Ascent" }, mode: "Competitive",
        started_at: new Date(match.metadata.game_start * 1000).toISOString(), season: { id: "season", short: "e11a6" } },
      stats: { team: "Red", character: { name: "Jett" }, kills: 12, deaths: 12, assists: 3, score: 4800 },
      teams: { red: 13, blue: 11 },
    }];
    return Response.json({ status: 200, data });
  };
  async function resolveServer(node) {
    if (Array.isArray(node)) return Promise.all(node.map(async (child, index) => {
      const resolved = await resolveServer(child);
      return React.isValidElement(resolved) && resolved.key === null
        ? React.cloneElement(resolved, { key: index }) : resolved;
    }));
    if (!React.isValidElement(node)) return node;
    if (typeof node.type === "function" && node.type.constructor.name === "AsyncFunction") {
      return resolveServer(await node.type(node.props));
    }
    if (Object.hasOwn(node.props, "children")) {
      return React.cloneElement(node, {}, await resolveServer(node.props.children));
    }
    return node;
  }
  async function page(id = "Budget%20Player%23TAG", tab, query = {}) {
    const tree = await resolveServer(await app.Page({
      params: Promise.resolve({ id, tab }), searchParams: Promise.resolve(query),
    }));
    return renderToStaticMarkup(React.createElement(app.I18nProvider, { locale: "ja", dict: app.dicts.ja }, tree));
  }
  async function flush() {
    pending.splice(0).forEach((finish) => finish());
    while (globalThis.__after.length) {
      await Promise.all(globalThis.__after.splice(0).map((task) => task()));
    }
  }
  async function reset(next) {
    await flush();
    app.resetHenrikClient(); app.resetProfileCache();
    await app.execute("DELETE FROM HenrikQuota");
    scenario = next; calls = 0;
    requested.length = 0;
  }
  let browser, server;
  const externalNavigation = { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate",
    "sec-fetch-dest": "document", "sec-fetch-user": "?1" };
  let lastDocumentHeaders;
  try {
    for (const meta of [
      { ...externalNavigation, "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" },
      { ...externalNavigation, "sec-fetch-dest": "iframe" },
      { ...externalNavigation, "sec-purpose": "prefetch;prerender" },
    ]) {
      await reset("fast"); globalThis.__fetchMetadata = meta;
      const blocked = await page();
      assert.match(blocked, /kt-profile-navigation/);
      assert.doesNotMatch(blocked, /登録されていないアカウント|data-profile-continue/);
      assert.equal(calls, 0, "cross-site embeds/fetch/speculation must spend no upstream quota");
      assert.equal(globalThis.__after.length, 0);
    }
    globalThis.__fetchMetadata = { ...externalNavigation };
    delete globalThis.__fetchMetadata["sec-fetch-user"];
    const confirmation = await page(selfId, ["assessment"], { playlist: "all", act: "e7a3",
      played: "against", page: "2", country: "Vnm" });
    assert.match(confirmation, /kt-profile-navigation/);
    assert.doesNotMatch(confirmation, /登録されていないアカウント/);
    assert.match(confirmation, new RegExp(`href="/valorant/profile/riot/${selfId}/assessment\\?`));
    for (const filter of ["playlist=all", "act=e7a3", "played=against", "page=2", "country=Vnm"]) {
      assert.ok(confirmation.includes(filter), `confirmation preserves ${filter}`);
    }
    assert.equal(calls, 0, "non-activated redirect must wait for confirmation");
    assert.equal(globalThis.__after.length, 0);
    globalThis.__fetchMetadata = externalNavigation;
    for (const denied of [false, true]) {
      globalThis.__allowed = false; globalThis.__denied = denied;
      assert.match(await page(), /kt-access-gate/);
      assert.doesNotMatch(await page(), /data-profile-continue/, "no navigation recovery before authorization");
      assert.equal(calls, 0, "external links cannot bypass Discord authorization");
    }
    globalThis.__allowed = true; globalThis.__denied = false;
    await reset("fast");
    const byPuuid = await page(selfId);
    assert.match(byPuuid, /Budget Player/);
    assert.match(byPuuid, new RegExp(`/valorant/profile/riot/${selfId}/matches`));
    assert.equal(calls, 5, "PUUID resolves once plus four profile reads, not an extra name lookup");
    assert.equal(requested[0], `https://api.henrikdev.xyz/valorant/v1/by-puuid/account/${selfId}`);
    assert.equal(requested.filter(url => url.includes("/v1/account/")).length, 0);
    await flush();
    globalThis.__fetchMetadata = undefined;
    console.log("PASS: authorized external PUUID navigation works; unauthenticated/denied and embedded requests spend zero quota");
    await reset("optional");
    server = http.createServer(async (req, res) => {
      const target = `http://127.0.0.1:${server.address().port}`;
      if (req.url === "/redirect") { res.writeHead(302, { Location: target }); return res.end(); }
      if (req.headers.host?.startsWith("localhost:")) {
        res.setHeader("Content-Type", "text/html");
        const destination = `${target}/valorant/profile/riot/${selfId}/assessment?playlist=all&act=e7a3&page=2&country=Vnm`;
        if (req.url === "/relay") {
          return res.end(`<script>setTimeout(()=>location.replace(${JSON.stringify(destination)}),6100)</script>`);
        }
        if (req.url === "/meta") return res.end(`<meta http-equiv="refresh" content="0;url=${destination}">`);
        return res.end('<a id="profile" href="/redirect">Open tracker</a> <a id="relay" href="/relay">JS relay</a> <a id="meta" href="/meta">HTML relay</a>');
      }
      globalThis.__fetchMetadata = req.headers;
      lastDocumentHeaders = req.headers;
      try {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        const url = new URL(req.url, target), parts = url.pathname.split("/");
        const markup = parts[1] === "valorant"
          ? await page(parts[4], [parts[5]], Object.fromEntries(url.searchParams))
          : await page();
        res.end(`<!doctype html><html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${markup}</body></html>`);
      }
      catch (error) { res.statusCode = 500; res.end(String(error)); }
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await puppeteer.launch({ headless: true, args: ["--disable-background-networking"] });
    const tab = await browser.newPage();
    await tab.setRequestInterception(true);
    tab.on("request", (req) => req.isNavigationRequest() &&
      ["127.0.0.1", "localhost"].includes(new URL(req.url()).hostname) ? req.continue() : req.abort());
    const started = Date.now();
    await tab.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "domcontentloaded" });
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 10_000, `profile took ${elapsed}ms`);
    assert.match(await tab.$eval("body", (el) => el.textContent), /Budget Player/);
    assert.match(await tab.$eval("body", (el) => el.textContent), /未取得：ランク履歴/);
    assert.match(await tab.$eval("body", (el) => el.textContent), /Gold 1/);
    assert.equal(calls, 5, "one account plus four reads; no per-match fanout");
    console.log(`PASS: browser shows real profile + measured stats with one stalled API in ${elapsed}ms`);
    await flush();
    await tab.goto(`http://localhost:${server.address().port}/source`);
    await Promise.all([tab.waitForNavigation({ waitUntil: "domcontentloaded" }), tab.click("#profile")]);
    assert.match(await tab.$eval("body", (el) => el.textContent), /Budget Player/);
    for (const [key, value] of Object.entries(externalNavigation)) assert.equal(lastDocumentHeaders[key], value, key);
    globalThis.__fetchMetadata = undefined;
    await flush();
    console.log("PASS: real browser external link plus redirect retains user activation and opens the authorized profile");
    for (const relay of ["meta", "relay"]) {
      await reset("fast");
      await tab.goto(`http://localhost:${server.address().port}/source`);
      await tab.click(`#${relay}`);
      await tab.waitForFunction(() => location.hostname === "127.0.0.1" &&
        document.querySelector("[data-profile-continue]"), { timeout: 20_000 });
      assert.equal(lastDocumentHeaders["sec-fetch-site"], "cross-site");
      assert.equal(lastDocumentHeaders["sec-fetch-mode"], "navigate");
      assert.equal(lastDocumentHeaders["sec-fetch-dest"], "document");
      assert.equal(lastDocumentHeaders["sec-fetch-user"], undefined, "relay loses the original user gesture");
      assert.equal(calls, 0, `${relay} must spend zero quota before confirmation`);
      assert.equal(globalThis.__after.length, 0, `${relay} must enqueue no paid background work`);
      assert.doesNotMatch(await tab.$eval("body", e => e.textContent), /登録されていないアカウント/);
      const href = await tab.$eval("[data-profile-continue]", e => e.getAttribute("href"));
      assert.ok(href.startsWith(`/valorant/profile/riot/${selfId}/assessment?`));
      assert.ok(href.includes("playlist=all") && href.includes("act=e7a3") && href.includes("page=2") && href.includes("country=Vnm"));
      const chunks = path.join(root, ".next/static/chunks");
      const css = fs.readdirSync(chunks).filter(f => f.endsWith(".css"))
        .map(f => fs.readFileSync(path.join(chunks, f), "utf8")).join("\n");
      await tab.addStyleTag({ content: css });
      for (const width of [1440, 1024, 375]) {
        await tab.setViewport({ width, height: 900 });
        assert.equal(await tab.$eval(".kt-profile-navigation", e =>
          e.scrollWidth <= e.clientWidth + 1), true, `confirmation overflow at${width}px`);
        assert.equal(await tab.$eval("[data-profile-continue]", e => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 1 && r.height >= 40;
        }), true, `confirmation action unavailable at${width}px`);
      }
      await Promise.all([tab.waitForNavigation({ waitUntil: "domcontentloaded" }), tab.click("[data-profile-continue]")]);
      assert.equal(lastDocumentHeaders["sec-fetch-site"], "same-origin");
      assert.match(await tab.$eval("body", e => e.textContent), /Budget Player/);
      assert.doesNotMatch(await tab.$eval("body", e => e.textContent), /クリック情報を確認/);
      globalThis.__fetchMetadata = undefined;
      await flush();
      console.log(`PASS: real browser ${relay} loses activation; zero-work responsive confirmation preserves profile/tab/filters and same-origin click opens profile`);
    }
    const key = app.profileCacheKey(account.name, account.tag, { mode: "competitive" });
    const saved = await app.readProfileSnapshot(key, Date.now() + 1000);
    assert.ok(saved, "late completion saves the full snapshot");
    saved.bundle.capturedAt = new Date(Date.now() - 600_000).toISOString();
    // Seed age in this isolated memory DB; production writes intentionally reject backdating.
    await app.execute("UPDATE ProfileSnapshot SET capturedAt = 0 WHERE cacheKey = ?", [key]);
    await app.writeProfileSnapshot(key, saved);
    assert.equal((await app.readProfileSnapshot(key, Date.now() + 1000)).bundle.capturedAt, saved.bundle.capturedAt);
    scenario = "all"; app.resetHenrikClient(); calls = 0;
    const cacheStart = Date.now();
    const cached = await page();
    const cachedMs = Date.now() - cacheStart;
    assert.ok(cachedMs < 500);
    assert.match(cached, /保存したプロフィール/);
    assert.equal(calls, 0, "SWR returns before starting deferred work");
    globalThis.__accessDelay = 2_000;
    assert.match(await page(), /Budget Player/, "a slow valid session must not be misclassified as logged out");
    globalThis.__accessDelay = 0;
    globalThis.__allowed = false;
    assert.ok(!(await page()).includes("Budget Player"), "access is checked before serving snapshots");
    globalThis.__allowed = true;
    scenario = "private";
    await flush();
    assert.equal(await app.readProfileSnapshot(key, Date.now() + 1000), null,
      "a private response must evict the snapshot, not become a stale fallback");
    console.log(`PASS: stale snapshot returns in ${cachedMs}ms, is labelled, and remains access-gated`);
    await reset("all");
    const empty = await page();
    assert.match(empty, /表示を保留/);
    assert.ok(!empty.includes("K/D Ratio"), "unavailable data must not render as zero stats");
    console.log("PASS: stalled histories show identity and unavailable state, never zero statistics");
    await reset("identity");
    // A previously saved identity is intentionally restorable; use a genuinely unseen player.
    const identity = await page("Unseen%20Player%23TAG");
    assert.match(identity, /取得元の応答に時間/);
    assert.match(identity, /aria-label="再試行"/);
    console.log("PASS: unknown identity times out with retry rather than an endless skeleton");
    await reset("fast");
    globalThis.__accessDelay = 8_500;
    const access = await page();
    assert.match(access, /ログイン状態の確認に時間/);
    assert.ok(!access.includes("取得元の応答"), "auth failure must not be blamed on the stats provider");
    assert.equal(calls, 0, "auth deadline cannot start provider calls");
    globalThis.__accessDelay = 0;
    console.log("PASS: auth deadline is distinct from provider failure and starts zero upstream calls");
  } finally {
    globalThis.__accessDelay = 0;
    globalThis.__fetchMetadata = undefined; globalThis.__denied = false;
    await browser?.close();
    await new Promise((resolve) => server ? server.close(resolve) : resolve());
    await flush();
    globalThis.fetch = realFetch;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
