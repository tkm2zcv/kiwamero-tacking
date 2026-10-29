"""Capture tracker.gg tab pages (screenshot + section text + landmarks) for one profile."""
import json
import pathlib

from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "https://tracker.gg/valorant/profile/riot/Meiy%23B3L"
QS = "?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319"
TABS = ["matches", "performance", "agents", "maps", "weapons"]

JS = """
() => {
  const out = { sections: [], landmarks: {} };
  // dump headings and card titles
  for (const el of document.querySelectorAll("h1,h2,h3,[class*='title'],[class*='header']")) {
    const t = (el.innerText || "").trim();
    const r = el.getBoundingClientRect();
    if (t && r.y > 60 && r.y < 8000 && t.length < 120) out.sections.push({ tag: el.tagName, t, y: Math.round(r.y), x: Math.round(r.x) });
  }
  // dump main content area text (first 4000 chars)
  const main = document.querySelector("main") || document.body;
  out.mainText = (main.innerText || "").slice(0, 5000);
  return out;
}
"""


def make_action(name):
    def action(page):
        page.wait_for_timeout(6000)
        page.screenshot(path=str(OUT / f"ref-{name}.png"))
        data = page.evaluate(JS)
        (OUT / f"ref-{name}.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
        print("shot", name, flush=True)
    return action


with StealthySession(headless=True) as session:
    for tab in TABS:
        session.fetch(f"{BASE}/{tab}{QS}", network_idle=False, timeout=120000, wait=2000,
                      page_action=make_action(tab), viewport={"width": 1920, "height": 1080})
