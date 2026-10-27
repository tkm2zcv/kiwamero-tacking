"""Screenshot the 3 tracker sites via page_action (playwright page)."""
import sys, json, pathlib

sys.stdout.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SHOTS = ROOT / "docs" / "screenshots"
SHOTS.mkdir(parents=True, exist_ok=True)

TARGETS = {
    "tracker-gg": "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319",
    "vtl": "https://vtl.lol/id/Meiy_B3L",
    "valosmurf-login": "https://tracker.valosmurf.net/tracker/71bedae8-34a7-599b-b927-0b956f6ddf25",
}

from scrapling.fetchers import StealthyFetcher

def make_action(name):
    def action(page):
        page.wait_for_timeout(5000)
        try:
            page.screenshot(path=str(SHOTS / f"{name}-desktop.png"), full_page=False)
        except Exception as e:
            print(f"shot fail {name}: {e}", flush=True)
        try:
            page.evaluate("window.scrollTo(0, 1200)")
            page.wait_for_timeout(1500)
            page.screenshot(path=str(SHOTS / f"{name}-scroll.png"), full_page=False)
        except Exception as e:
            print(f"scroll shot fail {name}: {e}", flush=True)
    return action

for name, url in TARGETS.items():
    try:
        StealthyFetcher.fetch(
            url, headless=True, network_idle=True, timeout=120000,
            page_action=make_action(name),
        )
        print(json.dumps({name: "done"}, ensure_ascii=False), flush=True)
    except Exception as e:
        print(json.dumps({name: f"error {str(e)[:300]}"}, ensure_ascii=False), flush=True)
