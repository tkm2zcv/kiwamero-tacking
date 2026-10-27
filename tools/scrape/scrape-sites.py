"""Scrape the 3 tracker sites: rendered HTML + screenshots."""
import sys, json, pathlib

sys.stdout.reconfigure(encoding="utf-8")

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research"
SHOTS = ROOT / "docs" / "screenshots"
OUT.mkdir(parents=True, exist_ok=True)
SHOTS.mkdir(parents=True, exist_ok=True)

TARGETS = {
    "tracker-gg": "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview?platform=pc&playlist=competitive&season=d816f426-48ea-f052-117f-9697a155b319",
    "vtl": "https://vtl.lol/id/Meiy_B3L",
    "valosmurf": "https://tracker.valosmurf.net/tracker/71bedae8-34a7-599b-b927-0b956f6ddf25",
}

from scrapling.fetchers import StealthyFetcher

results = {}
for name, url in TARGETS.items():
    try:
        page = StealthyFetcher.fetch(
            url,
            headless=True,
            network_idle=True,
            timeout=120000,
            page_action=lambda p: p.wait_for_timeout(4000),
        )
        html = page.html_content
        (OUT / f"{name}.html").write_text(html, encoding="utf-8")
        results[name] = {"ok": True, "status": page.status, "bytes": len(html), "title": page.css("title::text").get("")}
        try:
            shot = page.screenshot(full_page=True)
            (SHOTS / f"{name}-full.png").write_bytes(shot)
            results[name]["screenshot"] = len(shot)
        except Exception as e:
            results[name]["screenshot_error"] = str(e)[:200]
    except Exception as e:
        results[name] = {"ok": False, "error": str(e)[:500]}
    print(json.dumps({name: results[name]}, ensure_ascii=False), flush=True)

print(json.dumps(results, ensure_ascii=False, indent=2))
