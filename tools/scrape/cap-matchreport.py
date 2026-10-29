import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = "https://tracker.gg/valorant/match/4ea0c458-0a8c-43a3-9c21-8e4d5a54c587"

def action(page):
    page.wait_for_timeout(10000)
    page.screenshot(path=str(OUT / "ref-matchreport.png"), full_page=False)
    # scoreboard area
    for sel in [".scoreboard", ".match-details", "main", ".v3-card"]:
        c = page.query_selector(sel)
        if c:
            h = c.evaluate("e => e.outerHTML")
            (OUT / f"ref-matchreport-{sel.replace('.','').replace('[','').replace(']','')}.html").write_text(h, encoding="utf-8")
            print("saved", sel, len(h), flush=True)
            break

with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=3000,
        page_action=action, viewport={"width":1920,"height":1080})
print("ok", flush=True)
