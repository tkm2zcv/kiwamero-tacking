"""Open headed Camoufox -> user completes Discord login -> capture app pages."""
import sys, json, time, pathlib, re

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research"
SHOTS = ROOT / "docs" / "screenshots"
PROFILE = ROOT / "tools" / "scrape" / ".valosmurf-profile"
SHOTS.mkdir(parents=True, exist_ok=True)

TARGET = "https://tracker.valosmurf.net/tracker/71bedae8-34a7-599b-b927-0b956f6ddf25"

EXTRACT_JS = r"""
async () => {
  const out = {vars: {}, computed: {}};
  const rootStyles = getComputedStyle(document.documentElement);
  for (const name of rootStyles) {
    if (name.startsWith('--')) out.vars[name] = rootStyles.getPropertyValue(name).trim();
  }
  const links = Array.from(document.querySelectorAll('link[rel=stylesheet]')).map(l => l.href);
  out.css = [];
  for (const href of links) {
    try { out.css.push(await (await fetch(href)).text()); } catch (e) {}
  }
  const pick = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    return {bg: c.backgroundColor, color: c.color, font: c.fontFamily, fontSize: c.fontSize, radius: c.borderRadius};
  };
  out.computed.body = pick('body');
  out.computed.card = pick('[class*=card], [class*=Card]');
  out.links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/') && !h.startsWith('//'));
  return out;
}
"""

from scrapling.fetchers import StealthySession

captured = []

def slug(url):
    s = re.sub(r'[^a-zA-Z0-9]+', '-', url.split('?')[0]).strip('-') or 'root'
    return s[-60:]

def capture(page, tag):
    try:
        url = page.url
        (OUT / f"valosmurf-app-{tag}.html").write_text(page.content(), encoding="utf-8")
        page.screenshot(path=str(SHOTS / f"valosmurf-app-{tag}.png"), full_page=False)
        data = page.evaluate(EXTRACT_JS)
        (OUT / f"valosmurf-app-{tag}-tokens.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        captured.append({"tag": tag, "url": url})
        print(json.dumps({"captured": tag, "url": url}), flush=True)
        return data
    except Exception as e:
        print(json.dumps({"capture_error": tag, "err": str(e)[:200]}), flush=True)
        return {}

def action(page):
    page.wait_for_timeout(2000)
    # 1) wait for user to finish Discord OAuth (URL leaves /login + discord.com)
    deadline = time.time() + 360
    last = ""
    while time.time() < deadline:
        url = page.url
        if url != last:
            print(json.dumps({"waiting_for_login": url[:120]}), flush=True)
            last = url
        if "discord.com" not in url and "/login" not in url:
            break
        page.wait_for_timeout(1000)
    print(json.dumps({"login_done_url": page.url}), flush=True)
    page.wait_for_timeout(4000)

    # 2) capture main tracker page (top + scrolled + fullpage)
    data = capture(page, "main")
    try:
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(1500)
        page.screenshot(path=str(SHOTS / "valosmurf-app-main-bottom.png"), full_page=False)
        page.screenshot(path=str(SHOTS / "valosmurf-app-main-full.png"), full_page=True)
        page.evaluate("window.scrollTo(0, 0)")
    except Exception as e:
        print(f"scroll shot fail: {e}", flush=True)

    # 3) visit internal nav links
    seen = set()
    links = []
    for h in (data.get("links") or []):
        if h not in seen and not h.startswith("/api") and not h.startswith("/login") and not h.startswith("/_"):
            seen.add(h); links.append(h)
    for i, href in enumerate(links[:8]):
        try:
            page.goto("https://tracker.valosmurf.net" + href, wait_until="networkidle", timeout=45000)
            page.wait_for_timeout(2500)
            capture(page, f"p{i}-{slug(href)}")
        except Exception as e:
            print(json.dumps({"nav_error": href, "err": str(e)[:200]}), flush=True)

session = StealthySession(
    headless=False,
    user_data_dir=str(PROFILE),
    timeout=600000,
    locale="ja-JP",
)
session.start()
try:
    session.fetch(TARGET, page_action=action, network_idle=True, timeout=120000)
    session.save_state(OUT / "valosmurf-state.json")
    print(json.dumps({"done": captured}, ensure_ascii=False), flush=True)
finally:
    session.close()
