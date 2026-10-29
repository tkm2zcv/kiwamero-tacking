"""Extract design tokens + component rules + asset inventory from tracker.gg profile pages.

Outputs under docs/research/capture/:
  x-overview-html.html / x-overview-classes.json / x-overview-rules.css / x-overview-vars.json
  audit-vars.json      — all root custom properties (theme tokens)
  audit-media.json     — all media queries found in stylesheets
  audit-fonts.json     — font-family stacks + sizes used in kept rules
  audit-assets.json    — every external image/icon URL referenced in HTML+CSS
"""
import json
import pathlib
import re

from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
SEASON = "8102cd81-43a0-d0d7-bd59-47b8fe9bed1b"
BASE = "https://tracker.gg/valorant/profile/riot/Meiy%23B3L"
QS = f"?platform=pc&playlist=competitive&season={SEASON}"
TABS = ["overview"]

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
  const cs = getComputedStyle(document.documentElement);
  const vars = {};
  // ALL custom properties defined on :root
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        const sel = rule.selectorText || "";
        if (rule.style && (sel === ":root" || sel === "html" || sel === "body" || sel.includes("theme"))) {
          for (let i = 0; i < rule.style.length; i++) {
            const n = rule.style[i];
            if (n.startsWith("--")) vars[n] = cs.getPropertyValue(n).trim() || rule.style.getPropertyValue(n).trim();
          }
        }
      }
    } catch (e) {}
  }
  // all media queries
  const media = new Set();
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        if (rule.conditionText) media.add(rule.conditionText);
      }
    } catch (e) {}
  }
  // font stacks + sizes present in rules
  const fonts = new Set();
  const sizes = new Set();
  for (const r of rules) {
    for (const m of r.matchAll(/font-family:\\s*([^;}]+)/g)) fonts.add(m[1].trim());
    for (const m of r.matchAll(/font-size:\\s*([^;}]+)/g)) sizes.add(m[1].trim());
  }
  // every remote asset url in the dom
  const assets = new Set();
  root.querySelectorAll("[src],[srcset],[style],[data-bg],[href]").forEach(el => {
    ["src","srcset","style","data-bg","href"].forEach(a => {
      const v = el.getAttribute(a) || "";
      for (const m of v.matchAll(/https:\\/\\/[^"'\\s)]+/g)) {
        if (/\\.(png|jpg|jpeg|webp|svg|gif|avif)/i.test(m[0])) assets.add(m[0]);
      }
    });
  });
  return { html: root.outerHTML.slice(0, 500000), classes: [...used].sort(), rules, vars,
           media: [...media].sort(), fonts: [...fonts].sort(), sizes: [...sizes].sort(), assets: [...assets].sort() };
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
        (OUT / "audit-media.json").write_text(json.dumps(data["media"], indent=1), encoding="utf-8")
        (OUT / "audit-fonts.json").write_text(json.dumps({"families": data["fonts"], "sizes": data["sizes"]}, indent=1), encoding="utf-8")
        (OUT / "audit-assets.json").write_text(json.dumps(data["assets"], indent=1), encoding="utf-8")
        print(f"{name}: html={len(data['html'])} classes={len(data['classes'])} rules={len(data['rules'])} vars={len(data['vars'])} assets={len(data['assets'])}", flush=True)
    return action


with StealthySession(headless=True) as session:
    for tab in TABS:
        session.fetch(f"{BASE}/{tab}{QS}", network_idle=False, timeout=120000, wait=2000,
                      page_action=make_action(tab))
