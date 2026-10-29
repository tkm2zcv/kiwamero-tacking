import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/matches?platform=pc&playlist=competitive"

def action(page):
    page.wait_for_timeout(9000)
    # find real match rows in the matches card
    sels = page.eval_on_selector_all(
        ".matches .st-content__item, .matches [class*=match] .st-content__item, .st-content__item--link, .st-content__item",
        "els => els.slice(0,6).map(e => e.className)")
    print("row candidates:", sels, flush=True)
    row = page.query_selector(".st-content__item--link") or page.query_selector(".st-content__item")
    if row:
        box = row.bounding_box()
        print("row box", box, flush=True)
        row.click()
        page.wait_for_timeout(1600)
        # look for drawer after click
        d = page.eval_on_selector_all(
            ".st-content__drawer, .v3-match-details, [class*=scoreboard], [class*=drawer]",
            "els => els.map(e => ({cls: e.className, vis: getComputedStyle(e).display}))")
        print("drawers:", d[:10], flush=True)
        # dump parent st-content html
        c = page.query_selector(".matches .st-content, .st-content")
        if c:
            h = c.evaluate("e => e.outerHTML")
            (OUT / "ref-match-content.html").write_text(h, encoding="utf-8")
            print("content len", len(h), flush=True)
        page.screenshot(path=str(OUT / "ref-match-expanded2.png"))

with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=3000,
        page_action=action, viewport={"width":1920,"height":1080})
print("ok", flush=True)
