import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/matches?platform=pc&playlist=competitive"

def action(page):
    page.wait_for_timeout(9000)
    # click the first match row to expand
    row = page.query_selector(".match .st-content__item, .st-content__item--link, tr.row, .v3-match-row")
    print("row sel:", bool(row), flush=True)
    if row:
        row.click()
        page.wait_for_timeout(1500)
    page.screenshot(path=str(OUT / "ref-match-expanded.png"), full_page=False)
    # dump expanded drawer html
    exp = page.query_selector(".st-content__drawer, .expanded, [class*=expand], .match-details, .scoreboard")
    if exp:
        h = exp.evaluate("e => e.outerHTML")
        (OUT / "ref-match-expand.html").write_text(h, encoding="utf-8")
        print("expand len", len(h), flush=True)
    else:
        # dump whole matches card
        c = page.query_selector(".matches.v3-card, .v3-card")
        if c:
            h = c.evaluate("e => e.outerHTML")
            (OUT / "ref-match-card-expanded.html").write_text(h, encoding="utf-8")
            print("card len", len(h), flush=True)

with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=3000,
        page_action=action, viewport={"width":1920,"height":1080})
print("ok", flush=True)
