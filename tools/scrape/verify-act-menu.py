"""Verify act selector + performance page against tracker.gg reference."""
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
BASE = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L"


def action(page):
    page.wait_for_timeout(9000)
    # 1. Full performance page
    page.screenshot(path=str(OUT / "lay-perf-v7.png"))
    # 2. Performance card element shot
    card = page.query_selector(".performance.v3-card")
    if card:
        card.screenshot(path=str(OUT / "lay-perf-card.png"))
        print("perf card shot", flush=True)
    # 3. Sidebar (playtime + best matches)
    side = page.query_selector(".kt-sidebar")
    if side:
        side.screenshot(path=str(OUT / "lay-perf-side.png"))
    # 4. Open the bar's act menu (the kt-seg-menu button)
    btn = page.query_selector(".kt-seg-menu .kt-seg-btn")
    if btn:
        btn.click()
        page.wait_for_timeout(700)
        page.screenshot(path=str(OUT / "lay-actmenu.png"))
        # crop the dropdown panel itself
        panel = page.query_selector(".kt-menu-panel")
        if panel:
            panel.screenshot(path=str(OUT / "lay-actmenu-panel.png"))
        n = page.eval_on_selector_all(".kt-menu-panel a", "els => els.length")
        print("menu items:", n, flush=True)
        labels = page.eval_on_selector_all(".kt-menu-panel a span", "els => els.map(e=>e.textContent)")
        print("labels:", labels, flush=True)
    else:
        print("NO MENU BUTTON", flush=True)
    # 5. Filters bar state
    bar = page.query_selector(".kt-filters")
    if bar:
        bar.screenshot(path=str(OUT / "lay-filterbar.png"))


with StealthySession(headless=True) as session:
    session.fetch(
        f"{BASE}/performance?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=2000, page_action=action,
        viewport={"width": 1920, "height": 1080},
    )
print("ok", flush=True)
