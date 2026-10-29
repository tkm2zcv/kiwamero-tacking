import json
import pathlib
import urllib.request

env = pathlib.Path("kiwamero-tracking/.env").read_text(encoding="utf-8")
key = ""
for line in env.splitlines():
    if line.strip().startswith("HENRIK_API_KEY"):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")


def get(url):
    req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "curl/8.5.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read().decode("utf-8"))


base = "https://api.henrikdev.xyz"
acc = get(f"{base}/valorant/v1/account/Meiy/B3L")["data"]
puuid, region = acc["puuid"], acc["region"]

hist = get(f"{base}/valorant/v1/by-puuid/mmr-history/{region}/{puuid}")["data"]
print("mmr-history type:", type(hist).__name__, "keys:", list(hist.keys())[:12] if isinstance(hist, dict) else len(hist))
inner = hist.get("history") if isinstance(hist, dict) else None
if isinstance(inner, list):
    print("history entries:", len(inner))
    print(json.dumps(inner[0], indent=1)[:700])

mmr = get(f"{base}/valorant/v2/by-puuid/mmr/{region}/{puuid}")["data"]
by = mmr.get("by_season") or {}
print("by_season keys:", list(by.keys()))
last = list(by.keys())[-1]
print("last season:", last, json.dumps(by[last], indent=1)[:500])
print("current_data keys:", list((mmr.get("current_data") or {}).keys()))
print("highest_rank:", json.dumps(mmr.get("highest_rank")))
print("elo:", (mmr.get("current_data") or {}).get("elo"), "rr:", (mmr.get("current_data") or {}).get("ranking_in_tier"))
