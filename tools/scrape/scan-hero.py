import json
import sys

d = json.load(open("docs/research/capture/dom-1920.json", encoding="utf-8"))
y0 = int(sys.argv[1]) if len(sys.argv) > 1 else 250
y1 = int(sys.argv[2]) if len(sys.argv) > 2 else 390
xmax = int(sys.argv[3]) if len(sys.argv) > 3 else 760

out = []


def scan(n, dep):
    x, y, wd, h = n["r"]
    if y0 <= y <= y1 and x < xmax and h > 0:
        out.append((y, x, dep, n))
    for k in n.get("k", []):
        scan(k, dep + 1)


scan(d, 0)
out.sort(key=lambda t: (t[0], t[1]))
for y, x, dep, n in out:
    cls = (n.get("c") or "")[:70]
    s = n.get("s", {})
    src = (n.get("src") or "")[:70]
    txt = (n.get("x") or "")[:50]
    print("  " * min(dep, 22) + f"{n['t']}.{cls} {n['r']} "
          f"fs={s.get('fontSize', '')} fw={s.get('fontWeight', '')} br={s.get('borderRadius', '')} "
          f"img={src} txt={txt}")

