"""Screenshot an arbitrary local URL: python tools/scrape/shoot-url.py <url> <name> [width] [height]"""
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
url = sys.argv[1]
name = sys.argv[2]
width = int(sys.argv[3]) if len(sys.argv) > 3 else 1920
height = int(sys.argv[4]) if len(sys.argv) > 4 else 1080


def action(page):
    page.wait_for_timeout(7000)
    page.screenshot(path=str(OUT / f"{name}.png"))
    print("shot", name, flush=True)


with StealthySession(headless=True) as session:
    session.fetch(url, network_idle=False, timeout=120000, wait=2000, page_action=action,
                  viewport={"width": width, "height": height})
