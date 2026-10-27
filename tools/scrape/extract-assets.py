"""Extract asset URL mappings (agent->icon, map->img, card->art, logo) from captured HTML."""
import re, sys, json
sys.stdout.reconfigure(encoding="utf-8")
html = open("docs/research/valosmurf-app-main.html", encoding="utf-8").read()

out = {"agents": {}, "maps": set(), "ranks": set(), "cards": set(), "logo": set()}

# agent name -> icon: <img alt="Jett" ... src=".../agents/<uuid>/displayicon.png"
for m in re.finditer(r'<img[^>]*alt="([A-Za-z]+)"[^>]*src="[^"]*agents/([0-9a-f-]+)/displayicon\.png', html):
    out["agents"][m.group(1)] = m.group(2)
for m in re.finditer(r'agents/([0-9a-f-]{36})/displayicon\.png[^"]*"[^>]*alt="([A-Za-z]+)"', html):
    out["agents"][m.group(2)] = m.group(1)

# also alt before src ordering
for m in re.finditer(r'alt="([A-Za-z]+)"[^>]{0,400}?agents/([0-9a-f-]{36})', html):
    out["agents"].setdefault(m.group(1), m.group(2))

# map images
for m in re.finditer(r'/maps/([a-z]+)\.webp', html):
    out["maps"].add(m.group(1))
for m in re.finditer(r'alt="([A-Za-z]+)"[^>]{0,200}?/maps/', html):
    out["maps"].add(m.group(1).lower())

# rank icons
for m in re.finditer(r'competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/(\d+)/(\w+icon)\.png', html):
    out["ranks"].add(f"{m.group(1)}/{m.group(2)}")

# player cards
for m in re.finditer(r'playercards/([0-9a-f-]{36})/(\w+)\.png', html):
    out["cards"].add(f"{m.group(1)}/{m.group(2)}")

# logo
for m in re.finditer(r'<img[^>]*(?:alt="[^"]*[Kk]iwamero|src="[^"]*(?:logo|icon)[^"]*")[^>]*>', html):
    out["logo"].add(m.group(0)[:300])
for m in re.finditer(r'src="([^"]*(?:logo|chip|kiwamero)[^"]*)"', html):
    out["logo"].add(m.group(1))

for k in out:
    if isinstance(out[k], set):
        out[k] = sorted(out[k])
print(json.dumps(out, ensure_ascii=False, indent=2))
