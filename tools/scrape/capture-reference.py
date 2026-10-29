"""Capture tracker.gg profile page: DOM tree with computed styles, screenshots, assets.

Observe step of the clone workflow. Writes to docs/research/capture/.
"""
import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8")

from scrapling.fetchers import StealthyFetcher

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "assets").mkdir(exist_ok=True)

URL = (
    "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview"
    "?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319"
)

JS_DUMP = r"""
() => {
  const PROPS = ["display","position","flexDirection","flexWrap","alignItems","justifyContent",
    "gap","rowGap","columnGap","gridTemplateColumns","gridTemplateRows",
    "fontFamily","fontSize","fontWeight","lineHeight","letterSpacing","textTransform",
    "color","backgroundColor","backgroundImage","backgroundSize","backgroundPosition",
    "borderRadius","borderTopWidth","borderTopColor","borderStyle","boxShadow","opacity",
    "paddingTop","paddingRight","paddingBottom","paddingLeft",
    "marginTop","marginRight","marginBottom","marginLeft",
    "width","height","minHeight","maxWidth","overflow","zIndex","textAlign","whiteSpace","filter"];
  const skip = new Set(["SCRIPT","STYLE","NOSCRIPT","LINK","META","HEAD","TITLE","PATH","DEFS","CLIPPATH","LINEARGRADIENT","STOP","G"]);
  const r = (n) => Math.round(n * 10) / 10;
  function walk(el, depth) {
    if (skip.has(el.tagName)) return null;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return null;
    const b = el.getBoundingClientRect();
    if (b.width === 0 && b.height === 0) return null;
    const node = {
      t: el.tagName.toLowerCase(),
      d: depth,
      r: [r(b.x + scrollX), r(b.y + scrollY), r(b.width), r(b.height)],
    };
    const cls = typeof el.className === "string" ? el.className.trim() : "";
    if (cls) node.c = cls;
    const id = el.id;
    if (id) node.i = id;
    if (el.tagName === "IMG") { node.src = el.getAttribute("src") || ""; node.alt = el.getAttribute("alt") || ""; }
    if (el.tagName === "A") node.href = el.getAttribute("href") || "";
    const s = {};
    for (const p of PROPS) {
      let v = cs[p];
      if (!v || v === "none" || v === "normal" || v === "auto" || v === "0px" || v === "rgba(0, 0, 0, 0)") continue;
      if (p === "position" && v === "static") continue;
      if (p === "opacity" && v === "1") continue;
      if (p === "fontWeight" && v === "400") continue;
      if (p === "textAlign" && v === "start") continue;
      if (p === "whiteSpace" && v === "normal") continue;
      if (p === "backgroundSize" && v === "auto") continue;
      if (p === "backgroundPosition" && (v === "0% 0%" || v === "0px 0px")) continue;
      if (p === "flexDirection" && v === "row") continue;
      if (p === "alignItems" && v === "normal") continue;
      if (p === "justifyContent" && v === "normal") continue;
      if (p === "borderStyle" && v === "none") continue;
      if (p === "textTransform" && v === "none") continue;
      if (p === "letterSpacing" && (v === "normal" || v === "0px")) continue;
      s[p] = v;
    }
    if (Object.keys(s).length) node.s = s;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    if (own) node.x = own.slice(0, 160);
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

JS_ASSETS = r"""
() => {
  const urls = new Set();
  for (const el of document.querySelectorAll("img")) {
    if (el.currentSrc) urls.add(el.currentSrc);
    if (el.src) urls.add(el.src);
  }
  for (const el of document.querySelectorAll("*")) {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      for (const m of bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)) urls.add(m[1]);
    }
  }
  return Array.from(urls).filter((u) => u.startsWith("http"));
}
"""

JS_FONTS = r"""
() => Array.from(document.fonts).map((f) => ({ family: f.family, weight: f.weight, style: f.style, status: f.status }))
"""


def action(page):
    page.wait_for_timeout(9000)
    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception:
        pass
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(2500)

    page.screenshot(path=str(OUT / "ref-1920.png"), full_page=False)
    page.screenshot(path=str(OUT / "ref-1920-full.png"), full_page=True)

    tree = page.evaluate(JS_DUMP)
    (OUT / "dom-1920.json").write_text(json.dumps(tree, ensure_ascii=False), encoding="utf-8")

    assets = page.evaluate(JS_ASSETS)
    fonts = page.evaluate(JS_FONTS)
    (OUT / "assets.json").write_text(json.dumps(assets, ensure_ascii=False, indent=1), encoding="utf-8")
    (OUT / "fonts.json").write_text(json.dumps(fonts, ensure_ascii=False, indent=1), encoding="utf-8")

    html = page.content()
    (OUT / "page-1920.html").write_text(html, encoding="utf-8")
    print("tree bytes", len(json.dumps(tree)), "assets", len(assets), "fonts", len(fonts), flush=True)

    # mobile pass
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / "ref-390.png"), full_page=False)
    page.screenshot(path=str(OUT / "ref-390-full.png"), full_page=True)


print("fetching", URL, flush=True)
StealthyFetcher.fetch(
    URL,
    headless=True,
    network_idle=True,
    timeout=180000,
    solve_cloudflare=True,
    page_action=action,
    viewport={"width": 1920, "height": 1080},
)
print("done", flush=True)
