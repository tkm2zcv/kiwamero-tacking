import pathlib
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"
QS = "?platform=pc&playlist=competitive&season=latest"
def mk(name, action_extra=None):
    def action(page):
        page.wait_for_timeout(6000)
        page.screenshot(path=str(OUT / f"local3-{name}.png"))
        print("shot", name, flush=True)
    return action
with StealthySession(headless=True) as session:
    session.fetch(f"{BASE}/encounters{QS}", network_idle=False, timeout=120000, wait=2000,
                  page_action=mk("encounters"), viewport={"width": 1920, "height": 1080})
    session.fetch(f"{BASE}/agents{QS}", network_idle=False, timeout=120000, wait=2000,
                  page_action=mk("agents-mobile"), viewport={"width": 390, "height": 844})
