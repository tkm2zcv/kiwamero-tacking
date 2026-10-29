"""Extract real component HTML + CSS rules + theme vars from tracker.gg profile tabs."""
import json
import pathlib

from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
SEASON = "8102cd81-43a0-d0d7-bd59-47b8fe9bed1b"
BASE = "https://tracker.gg/valorant/profile/riot/Meiy%23B3L"
QS = f"?platform=pc&playlist=competitive&season={SEASON}"
TABS = ["agents", "maps", "encounters", "matches"]

JS = """
(rootSel) => {
  const root = document.querySelector(rootSel) || document.querySelector("main") || document.body;
  const used = new Set();
  root.querySelectorAll("*").forEach(el => {
    (el.getAttribute("class") || "").split(/\\s+/).forEach(c => c && used.add(c));
  });
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText && [...used].some(c => rule.cssText.includes("." + c))) rules.push(rule.cssText);
      }
    } catch (e) {}
  }
  // Root custom properties actually defined on <html>/<body>/theme class
  const vars = {};
  const cs = getComputedStyle(document.documentElement);
  for (const name of ["--color-surface-1","--color-surface-2","--color-surface-3","--color-surface-4",
    "--color-text","--color-text-primary","--color-text-secondary","--color-text-disabled",
    "--color-action","--color-action-contrast","--color-accent","--color-background","--color-win","--color-loss",
    "--st-row-height","--st-row-height-mobile","--st-row-color","--st-row-color-secondary",
    "--st-row-color-opacity-50","--st-row-color-hover","--st-gap","--st-row-gap","--st-min-width",
    "--color-rgb-surface-1","--color-rgb-surface-2","--color-rgb-surface-3","--color-rgb-action",
    "--color-rgb-text-primary","--color-rgb-text-secondary","--color-rgb-text-tertiary","--color-rgb-background","--color-rgb-gold"]) {
    vars[name] = cs.getPropertyValue(name).trim();
  }
  return { html: root.outerHTML.slice(0, 500000), classes: [...used].sort(), rules, vars };
}
"""


def make_action(name):
    def action(page):
        page.wait_for_timeout(6000)
        data = page.evaluate(JS, ".trn-profile")
        (OUT / f"x-{name}-html.html").write_text(data["html"], encoding="utf-8")
        (OUT / f"x-{name}-classes.json").write_text(json.dumps(data["classes"], indent=0), encoding="utf-8")
        (OUT / f"x-{name}-rules.css").write_text("\n".join(data["rules"]), encoding="utf-8")
        (OUT / f"x-{name}-vars.json").write_text(json.dumps(data["vars"], indent=1), encoding="utf-8")
        print(f"{name}: html={len(data['html'])} classes={len(data['classes'])} rules={len(data['rules'])}", flush=True)
    return action


with StealthySession(headless=True) as session:
    for tab in TABS:
        session.fetch(f"{BASE}/{tab}{QS}", network_idle=False, timeout=120000, wait=2000,
                      page_action=make_action(tab), viewport={"width": 1920, "height": 1080})
