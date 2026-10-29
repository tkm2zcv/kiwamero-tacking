"""Capture tracker.gg profile page (v2): controlled waits, progress log, robust failure.

Run: python tools/scrape/capture-reference.py > docs/research/capture/log.txt 2>&1
"""
import json
import pathlib
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)

from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "assets").mkdir(exist_ok=True)

URL = (
    "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview"
    "?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319"
)


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


PROPS = [
    "display", "position", "flexDirection", "flexWrap", "alignItems", "justifyContent",
    "gap", "rowGap", "columnGap", "gridTemplateColumns", "gridTemplateRows",
    "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textTransform",
    "color", "backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition",
    "borderRadius", "borderTopWidth", "borderTopColor", "borderBottomWidth", "borderBottomColor",
    "borderLeftWidth", "borderRightWidth", "borderStyle", "boxShadow", "opacity",
    "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "marginTop", "marginRight", "marginBottom", "marginLeft",
    "width", "height", "minHeight", "maxWidth", "overflow", "zIndex", "textAlign",
    "whiteSpace", "filter", "transform", "outline",
]

JS_DUMP = """
(args) => {
  const PROPS = args.props;
  const skip = new Set(["SCRIPT","STYLE","NOSCRIPT","LINK","META","HEAD","TITLE",
    "PATH","DEFS","CLIPPATH","LINEARGRADIENT","STOP","G","USE","SYMBOL","RECT","CIRCLE"]);
  const r = (n) => Math.round(n * 10) / 10;
  const DEFAULT = {position:"static",opacity:"1",fontWeight:"400",textAlign:"start",
    whiteSpace:"normal",backgroundSize:"auto",backgroundPosition:"0% 0%",
    flexDirection:"row",alignItems:"normal",justifyContent:"normal",
    borderStyle:"none",textTransform:"none",letterSpacing:"normal",display:"block",
    transform:"none",filter:"none",outline:"0px none rgb(0, 0, 0)"};
  function walk(el, depth) {
    if (skip.has(el.tagName)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return null;
    const b = el.getBoundingClientRect();
    if (b.width < 0.5 && b.height < 0.5) return null;
    const node = {t: el.tagName.toLowerCase(), d: depth,
      r: [r(b.x + scrollX), r(b.y + scrollY), r(b.width), r(b.height)]};
    const cls = typeof el.className === "string" ? el.className.trim() : "";
    if (cls) node.c = cls;
    if (el.id) node.i = el.id;
    if (el.tagName === "IMG") { node.src = el.getAttribute("src") || ""; node.alt = el.getAttribute("alt") || ""; }
    if (el.tagName === "A") node.href = el.getAttribute("href") || "";
    const s = {};
    for (const p of PROPS) {
      let v = cs[p];
      if (!v) continue;
      if (v === "none" || v === "normal" || v === "auto" || v === "0px" ||
          v === "rgba(0, 0, 0, 0)" || v === "0s") continue;
      if (DEFAULT[p] === v) continue;
      if (p === "opacity" && v === "1") continue;
      s[p] = v;
    }
    if (Object.keys(s).length) node.s = s;
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean).join(" ");
    if (own) node.x = own.slice(0, 200);
    if (el.tagName === "INPUT") node.v = el.getAttribute("placeholder") || "";
    const kids = [];
    for (const child of el.children) {
      const k = walk(child, depth + 1);
      if (k) kids.push(k);
    }
    if (kids.length) node.k = kids;
    return node;
  }
  return walk(document.body, 0);
}
"""

JS_ASSETS = """
() => {
  const urls = new Set();
  for (const el of document.querySelectorAll("img")) { if (el.currentSrc) urls.add(el.currentSrc); if (el.src) urls.add(el.src); }
  for (const el of document.querySelectorAll("*")) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") for (const m of bg.matchAll(/url\\(["']?([^"')]+)["']?\\)/g)) urls.add(m[1]);
  }
  return Array.from(urls).filter((u) => u.startsWith("http"));
}
"""

JS_FONTS = "() => Array.from(document.fonts).map(f => ({family:f.family, weight:f.weight, style:f.style, status:f.status}))"


def action(page):
    log("page_action start " + str(page.url))
    try:
        page.wait_for_selector(".trn-game-bar", timeout=45000)
        log("game bar found")
    except Exception as e:
        log("no game bar: " + str(e)[:200])
    page.wait_for_timeout(6000)
    try:
        page.evaluate("window.scrollTo(0, 600)")
        page.wait_for_timeout(2500)
        page.evaluate("window.scrollTo(0, 0)")
        page.wait_for_timeout(1500)
    except Exception as e:
        log("scroll failed " + str(e)[:120])

    page.screenshot(path=str(OUT / "ref-1920.png"))
    log("viewport shot done")
    try:
        page.screenshot(path=str(OUT / "ref-1920-full.png"), full_page=True)
        log("full shot done")
    except Exception as e:
        log("full shot failed " + str(e)[:150])

    tree = page.evaluate(JS_DUMP, {"props": PROPS})
    (OUT / "dom-1920.json").write_text(json.dumps(tree, ensure_ascii=False), encoding="utf-8")
    log("dom dumped")
    (OUT / "assets.json").write_text(json.dumps(page.evaluate(JS_ASSETS), indent=1), encoding="utf-8")
    (OUT / "fonts.json").write_text(json.dumps(page.evaluate(JS_FONTS), indent=1), encoding="utf-8")
    (OUT / "page-1920.html").write_text(page.content(), encoding="utf-8")
    log("artifacts written")

    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(3000)
    page.screenshot(path=str(OUT / "ref-390.png"))
    page.screenshot(path=str(OUT / "ref-390-full.png"), full_page=True)
    log("mobile shots done")


log("starting session")
with StealthySession(headless=True, solve_cloudflare=True) as session:
    log("session open, fetching")
    page = session.fetch(
        URL,
        network_idle=False,
        timeout=120000,
        wait=3000,
        page_action=action,
        viewport={"width": 1920, "height": 1080},
        google_search=False,
    )
    log("fetch returned status=" + str(getattr(page, "status", "?")))
log("done")
