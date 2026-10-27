"""Re-capture valosmurf tracker page with saved profile - wait for data load."""
import sys, json, time, pathlib

sys.stdout.reconfigure(encoding="utf-8")
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research"
SHOTS = ROOT / "docs" / "screenshots"
PROFILE = ROOT / "tools" / "scrape" / ".valosmurf-profile"

TARGET = "https://tracker.valosmurf.net/tracker/71bedae8-34a7-599b-b927-0b956f6ddf25"

from scrapling.fetchers import StealthySession

def action(page):
    page.wait_for_timeout(3000)
    # wait until LOADING text gone (data fetched) - max 120s
    deadline = time.time() + 120
    while time.time() < deadline:
        try:
            loading = page.evaluate("document.body.innerText.includes('LOADING') || document.body.innerText.includes('読み込み')")
            url = page.url
            if not loading and '/login' not in url:
                break
        except Exception:
            pass
        page.wait_for_timeout(1500)
    print(json.dumps({"final_url": page.url}), flush=True)
    page.wait_for_timeout(3000)

    (OUT / "valosmurf-app-main.html").write_text(page.content(), encoding="utf-8")
    page.screenshot(path=str(SHOTS / "valosmurf-app-main.png"), full_page=False)
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1500)
    page.screenshot(path=str(SHOTS / "valosmurf-app-main-bottom.png"), full_page=False)
    page.screenshot(path=str(SHOTS / "valosmurf-app-main-full.png"), full_page=True)
    page.evaluate("window.scrollTo(0, 0)")

    # collect tabs/links inside the tracker view and click through them
    tabs = page.evaluate("""Array.from(document.querySelectorAll('button, a, [role=tab]'))
      .map(e => (e.innerText||'').trim()).filter(t => t && t.length < 30).slice(0, 40)""")
    print(json.dumps({"ui_texts": tabs}, ensure_ascii=False), flush=True)
    links = page.evaluate("""Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.getAttribute('href')).filter(h => h && h.startsWith('/') && !h.startsWith('//'))""")
    print(json.dumps({"links": sorted(set(links))}, ensure_ascii=False), flush=True)

session = StealthySession(headless=True, user_data_dir=str(PROFILE), timeout=300000, locale="ja-JP")
session.start()
try:
    session.fetch(TARGET, page_action=action, network_idle=True, timeout=90000)
finally:
    session.close()
