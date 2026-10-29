"""Full-page screenshots of overview + matches + encounters for regression check."""
import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"

def mk(name):
    def action(page):
        page.wait_for_timeout(8000)
        page.screenshot(path=str(OUT / f"lay-{name}.png"))
        print("shot", name, flush=True)
    return action

with StealthySession(headless=True) as session:
    for tab in ["overview", "matches", "encounters"]:
        session.fetch(f"{BASE}/{tab}?platform=pc&playlist=competitive",
                      network_idle=False, timeout=120000, wait=2000,
                      page_action=mk(tab), viewport={"width": 1920, "height": 1080})
print("ok", flush=True)
