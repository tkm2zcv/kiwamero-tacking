import pathlib
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"
QS = "?platform=pc&playlist=competitive&season=latest"
def mk(name):
    def action(page):
        page.wait_for_timeout(7000)
        page.screenshot(path=str(OUT / f"local2-{name}.png"))
        print("shot", name, flush=True)
    return action
with StealthySession(headless=True) as session:
    for tab in ["matches"]:
        session.fetch(f"{BASE}/{tab}{QS}", network_idle=False, timeout=120000, wait=2000,
                      page_action=mk(tab), viewport={"width": 1920, "height": 1080})
