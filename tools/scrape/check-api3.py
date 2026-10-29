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
print("hist type", type(hist).__name__, "len", len(hist))
print("first entry keys:", list(hist[0].keys()) if isinstance(hist[0], dict) else hist[0])
print(json.dumps(hist[0], indent=1)[:800])
rr = [h.get("rr") for h in hist if isinstance(h, dict)]
print("rr values:", rr[:10])
print("max rr:", max([v for v in rr if isinstance(v, int)], default=None))
print("last entry:", json.dumps(hist[-1], indent=1)[:400])
