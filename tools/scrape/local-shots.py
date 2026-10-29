"""Screenshot local kiwamero-tracking pages for visual comparison."""
import sys, pathlib
sys.stdout.reconfigure(encoding="utf-8")

from scrapling.fetchers import StealthyFetcher

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SHOTS = ROOT / "docs" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L/overview?platform=pc&playlist=competitive&season=latest"

def action(page):
    page.wait_for_timeout(6000)
    page.screenshot(path=str(SHOTS / "local-desktop.png"), full_page=False)
    page.evaluate("window.scrollTo(0, 900)")
    page.wait_for_timeout(800)
    page.screenshot(path=str(SHOTS / "local-scroll.png"), full_page=False)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(1200)
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(500)
    page.screenshot(path=str(SHOTS / "local-mobile.png"), full_page=False)

StealthyFetcher.fetch(URL, headless=True, network_idle=True, timeout=120000, page_action=action,
                      viewport={"width": 1440, "height": 900})
print("done", flush=True)
