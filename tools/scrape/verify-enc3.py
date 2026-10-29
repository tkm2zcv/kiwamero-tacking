import pathlib, sys
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession
ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"

def a1(page):
    page.wait_for_timeout(5000)
    c = page.query_selector(".v3-card")
    if c: c.screenshot(path=str(OUT / "lay-enc-card.png"))
    page.screenshot(path=str(OUT / "lay-enc-v3.png"))

def a2(page):
    page.wait_for_timeout(5000)
    c = page.query_selector(".v3-card")
    if c: c.screenshot(path=str(OUT / "lay-audit-card.png"))

with StealthySession(headless=True) as session:
    session.fetch(f"{BASE}/encounters?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=2000, page_action=a1, viewport={"width":1920,"height":1080})
with StealthySession(headless=True) as session:
    session.fetch(f"{BASE}/assessment?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=2000, page_action=a2, viewport={"width":1920,"height":1080})
print("ok", flush=True)
