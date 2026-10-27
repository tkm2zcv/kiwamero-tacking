import re, sys, json
sys.stdout.reconfigure(encoding="utf-8")
html = open("docs/research/valosmurf-app-main.html", encoding="utf-8").read()
urls = sorted(set(re.findall(r'https://[^\s"\'\\)]+', html)))
for u in urls:
    if "media.valorant-api" in u and "playercards" not in u and "/agents/" not in u and "competitivetiers" not in u:
        print(u)
print("--- splash/map candidates ---")
for u in urls:
    if "maps" in u or "splash" in u:
        print(u)
