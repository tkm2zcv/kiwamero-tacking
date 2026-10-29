"""Capture matches page + activity card regions for comparison."""
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"
URL = "http://localhost:3002/valorant/profile/riot/Meiy%23B3L/matches"


def action(page):
    page.wait_for_timeout(9000)
    # locate the matches card and activity card to clip screenshots
    cards = page.evaluate(
        """() => {
        const out = {};
        const el = document.querySelector('.v3-card.gamereport, .v3-card');
        const m = document.querySelector('.v3-match-row');
        const mc = m ? m.closest('.v3-card') : null;
        if (mc) out.matches = mc.getBoundingClientRect();
        const a = document.querySelector('.activity-heatmaps');
        if (a) out.activity = a.getBoundingClientRect();
        return out;
    }"""
    )
    print("cards:", cards, flush=True)
    mc = cards.get("matches")
    if mc:
        clip = {
            "x": max(0, mc["x"] - 12),
            "y": max(0, mc["y"] - 12),
            "width": min(1920, mc["width"] + 24),
            "height": min(5400, mc["height"] + 24),
        }
        page.screenshot(path=str(OUT / "lay-matches-v2.png"), clip=clip)
    a = cards.get("activity")
    if a:
        clip = {
            "x": max(0, a["x"] - 12),
            "y": max(0, a["y"] - 12),
            "width": a["width"] + 24,
            "height": a["height"] + 24,
        }
        page.screenshot(path=str(OUT / "lay-activity-v2.png"), clip=clip)
    page.screenshot(path=str(OUT / "lay-matches-page.png"), full_page=True)
    print("shots done", flush=True)


with StealthySession(headless=True) as session:
    session.fetch(URL, network_idle=False, timeout=120000, wait=2000, page_action=action,
                  viewport={"width": 1920, "height": 1080})
print("ok", flush=True)
