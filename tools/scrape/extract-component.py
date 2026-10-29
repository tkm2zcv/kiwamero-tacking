"""Extract real component HTML + CSS rules from tracker.gg profile tabs."""
import json
import pathlib
import sys

from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = sys.argv[1] if len(sys.argv) > 1 else \
    "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/performance?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319"
NAME = sys.argv[2] if len(sys.argv) > 2 else "component"

JS = """
(rootSel) => {
  const root = document.querySelector(rootSel) || document.querySelector("main") || document.body;
  // Collect class names used inside root
  const used = new Set();
  root.querySelectorAll("*").forEach(el => {
    (el.getAttribute("class") || "").split(/\\s+/).forEach(c => c && used.add(c));
  });
  // Collect CSS rules from same-origin stylesheets matching used classes
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.cssText && [...used].some(c => rule.cssText.includes("." + c))) {
          rules.push(rule.cssText);
        }
      }
    } catch (e) {}
  }
  return {
    html: root.outerHTML.slice(0, 400000),
    classes: [...used].sort(),
    rules,
  };
}
"""

SELECTOR = sys.argv[3] if len(sys.argv) > 3 else ".trn-profile"


def action(page):
    page.wait_for_timeout(6000)
    data = page.evaluate(JS, SELECTOR)
    (OUT / f"{NAME}-html.html").write_text(data["html"], encoding="utf-8")
    (OUT / f"{NAME}-classes.json").write_text(json.dumps(data["classes"], indent=0), encoding="utf-8")
    (OUT / f"{NAME}-rules.css").write_text("\n".join(data["rules"]), encoding="utf-8")
    print(f"html={len(data['html'])} classes={len(data['classes'])} rules={len(data['rules'])}", flush=True)


with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=2000, page_action=action,
                  viewport={"width": 1920, "height": 1080})
