"""Dump landmark rects from the local page for geometry comparison with the reference."""
import json
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = (
    "http://localhost:3002/valorant/profile/riot/Meiy%23B3L/overview"
    "?platform=pc&playlist=competitive&season=latest"
)

SELECTORS = [
    ".kt-gamebar", ".kt-nav", ".kt-hero", ".kt-hero-avatar", ".kt-hero-name", ".kt-hero-tag",
    ".kt-hero-views", ".kt-hero-actions", ".kt-tabs", ".kt-tab", ".kt-adrow", ".kt-ad", ".kt-upsell",
    ".kt-filters", ".kt-filters > *", ".kt-columns", ".kt-sidebar", ".kt-maincol",
    ".kt-card", ".kt-card-head", ".kt-card-title", ".kt-card-body", ".kt-rating-top",
    ".kt-highlight", ".kt-highlight-content", ".kt-highlight-icon", ".kt-donut", ".kt-rank-chart",
    ".kt-giant-stats", ".kt-tile", ".kt-main-stats", ".kt-main-stat", ".kt-table", ".kt-thead",
    ".kt-trow", ".kt-hint", ".kt-mfilters", ".kt-gamereport", ".kt-timeline", ".kt-mrow",
]

JS = """
(sels) => {
  const out = {};
  for (const sel of sels) {
    const els = Array.from(document.querySelectorAll(sel)).slice(0, 4);
    out[sel] = els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        r: [Math.round(r.x + scrollX), Math.round(r.y + scrollY), Math.round(r.width), Math.round(r.height)],
        color: cs.color, bg: cs.backgroundColor, fs: cs.fontSize, fw: cs.fontWeight,
        ff: cs.fontFamily.split(",")[0], pad: cs.padding, br: cs.borderRadius,
      };
    });
  }
  return out;
}
"""


def action(page):
    page.wait_for_timeout(7000)
    data = page.evaluate(JS, SELECTORS)
    (OUT / "local-landmarks.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
    for sel, items in data.items():
        for item in items:
            print(f"{sel:28} {item['r']} fs={item['fs']} fw={item['fw']} color={item['color']} bg={item['bg']} pad={item['pad']}")
    print("done", flush=True)


with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=2000, page_action=action,
                  viewport={"width": 1920, "height": 1080})
