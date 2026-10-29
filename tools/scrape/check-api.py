import json
import pathlib
import urllib.request

env = pathlib.Path("kiwamero-tracking/.env").read_text(encoding="utf-8")
key = ""
for line in env.splitlines():
    if line.strip().startswith("HENRIK_API_KEY"):
        key = line.split("=", 1)[1].strip().strip('"').strip("'")
print("key present:", bool(key), "len", len(key))


def get(url):
    req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "curl/8.5.0"})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001
        return -1, repr(e)[:400]


base = "https://api.henrikdev.xyz"
s, acc = get(f"{base}/valorant/v1/account/Meiy/B3L")
print("account status:", s)
if s != 200:
    print("detail:", acc)
else:
    puuid, region = acc["data"]["puuid"], acc["data"]["region"]
    s2, hist = get(f"{base}/valorant/v1/by-puuid/mmr-history/{region}/{puuid}")
    print("mmr-history status:", s2)
    if s2 == 200:
        data = hist.get("data")
        print("entries:", len(data) if isinstance(data, list) else type(data).__name__)
        if isinstance(data, list) and data:
            print(json.dumps(data[0], indent=1)[:500])
    else:
        print("detail:", hist)
    s3, mmr = get(f"{base}/valorant/v2/by-puuid/mmr/{region}/{puuid}")
    print("mmr status:", s3)
    if s3 == 200:
        d = mmr.get("data", {})
        print("highest:", json.dumps(d.get("highest_rank"))[:300])
        print("current:", json.dumps(d.get("current_data"))[:300])
        print("by_season keys:", list((d.get("by_season") or {}).keys())[:10])
