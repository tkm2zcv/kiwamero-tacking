import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"

def action(page):
    page.wait_for_timeout(7000)
    rows = page.query_selector_all(".v3-match-row")
    print("rows:", len(rows), flush=True)
    if rows:
        rows[0].click()
        page.wait_for_timeout(1200)
        # scroll the expanded drawer into view
        dr = page.query_selector(".v3-mrow-drawer")
        if dr:
            dr.scroll_into_view_if_needed()
            dr.screenshot(path=str(OUT / "lay-scoreboard.png"))
        page.screenshot(path=str(OUT / "lay-match-expanded.png"))
        # party markers
        p = page.eval_on_selector_all(".st-entry-party", "els => els.map(e=>e.className)")
        print("party cells:", p, flush=True)
        # second row
        rows = page.query_selector_all(".v3-match-row")
        if len(rows) > 1:
            rows[1].click()
            page.wait_for_timeout(1000)
            dr2 = page.query_selector_all(".v3-mrow-drawer")
            if len(dr2) > 1:
                dr2[1].scroll_into_view_if_needed()
                dr2[1].screenshot(path=str(OUT / "lay-scoreboard2.png"))

with StealthySession(headless=True) as session:
    session.fetch(f"{BASE}/matches?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=2500, page_action=action,
        viewport={"width":1920,"height":1080})
print("ok", flush=True)
