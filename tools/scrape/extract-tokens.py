"""Extract CSS text + computed styles + root vars via in-page JS."""
import sys, json, pathlib

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research"

TARGETS = {
    "tracker-gg": "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319",
    "vtl": "https://vtl.lol/id/Meiy_B3L",
    "valosmurf": "https://tracker.valosmurf.net/tracker/71bedae8-34a7-599b-b927-0b956f6ddf25",
}

EXTRACT_JS = r"""
async () => {
  const out = {stylesheets: [], vars: {}, computed: {}};
  // root vars
  const rootStyles = getComputedStyle(document.documentElement);
  for (const name of rootStyles) {
    if (name.startsWith('--')) out.vars[name] = rootStyles.getPropertyValue(name).trim();
  }
  // fetch all same-origin stylesheets
  const links = Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href);
  for (const href of links) {
    try {
      const t = await (await fetch(href)).text();
      out.stylesheets.push({href, size: t.length, css: t.slice(0, 400000)});
    } catch (e) { out.stylesheets.push({href, error: String(e)}); }
  }
  // computed styles of body + key elements
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    return {bg: c.backgroundColor, color: c.color, font: c.fontFamily, fontSize: c.fontSize, radius: c.borderRadius};
  };
  out.computed.body = pick('body');
  out.computed.buttons = Array.from(document.querySelectorAll('button, a')).slice(0, 8).map(el => {
    const c = getComputedStyle(el);
    return {text: (el.textContent||'').trim().slice(0,40), bg: c.backgroundColor, color: c.color, radius: c.borderRadius, border: c.border};
  });
  return out;
}
"""

from scrapling.fetchers import StealthyFetcher

for name, url in TARGETS.items():
    try:
        def action(page, _name=name):
            page.wait_for_timeout(4000)
            data = page.evaluate(EXTRACT_JS)
            (OUT / f"{_name}-tokens.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            # save each css separately
            for i, ss in enumerate(data.get("stylesheets", [])):
                if ss.get("css"):
                    fn = OUT / f"{_name}-css-{i}.css"
                    fn.write_text(ss["css"], encoding="utf-8")
            print(json.dumps({_name: {"vars": len(data.get("vars", {})), "css_files": len(data.get("stylesheets", []))}}), flush=True)
        StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=120000, page_action=action)
    except Exception as e:
        print(json.dumps({name: f"error {str(e)[:300]}"}), flush=True)
