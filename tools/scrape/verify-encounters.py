"""Verify encounters page + new tabs against tracker.gg reference."""
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"


def action(page):
    page.wait_for_timeout(6000)
    page.screenshot(path=str(OUT / "lay-enc-v2.png"))
    card = page.query_selector(".v3-card")
    if card:
        card.screenshot(path=str(OUT / "lay-enc-card.png"))
    tabs = page.eval_on_selector_all("nav.kt-tabs a", "els => els.map(e => e.textContent.trim())")
    print("tabs:", tabs, flush=True)
    btn = page.query_selector(".v3-card__filters .v3-filter")
    if btn:
        btn.click()
        page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / "lay-enc-filter.png"))
        items = page.eval_on_selector_all(".kt-menu-panel a", "els => els.map(e => e.textContent.trim())")
        print("filter items:", items, flush=True)


with StealthySession(headless=True) as session:
    session.fetch(
        f"{BASE}/encounters?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=2000, page_action=action,
        viewport={"width": 1920, "height": 1080},
    )
print("ok", flush=True)
