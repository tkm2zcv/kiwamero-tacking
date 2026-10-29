"""Screenshot the local app at the reference viewport for visual comparison."""
import pathlib
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = (
    "http://localhost:3002/valorant/profile/riot/Meiy%23B3L/overview"
    "?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319"
)


def action(page):
    page.wait_for_timeout(9000)
    page.screenshot(path=str(OUT / "local-1920.png"))
    page.screenshot(path=str(OUT / "local-1920-full.png"), full_page=True)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(2500)
    page.screenshot(path=str(OUT / "local-390.png"))
    print("shots done", flush=True)


with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=2000, page_action=action,
                  viewport={"width": 1920, "height": 1080})
print("ok", flush=True)
