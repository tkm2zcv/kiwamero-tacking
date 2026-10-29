"""Inspect the captured tracker.gg DOM dump (v2).

Usage:
  python tools/scrape/inspect-dom.py outline --y0=120 --y1=650 --depth=20 [--x0=] [--x1=] [--skip=regex]
  python tools/scrape/inspect-dom.py find "text"
  python tools/scrape/inspect-dom.py path "text"
  python tools/scrape/inspect-dom.py sub "text" [--depth=8]
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
DATA = json.loads((ROOT / "docs" / "research" / "capture" / "dom-1920.json").read_text(encoding="utf-8"))

CORE = ("display", "position", "flexDirection", "flexWrap", "alignItems", "justifyContent", "gap",
        "gridTemplateColumns", "fontSize", "fontWeight", "lineHeight", "letterSpacing",
        "textTransform", "color", "backgroundColor", "borderRadius", "padding", "margin",
        "borderTopWidth", "borderTopColor", "opacity", "whiteSpace")


def sget(n, p):
    return n.get("s", {}).get(p)


def short(n, props=CORE):
    out = []
    for p in props:
        v = sget(n, p)
        if v:
            out.append(f"{p}:{v}")
    return " ".join(out)


def label(n):
    t = n["t"]
    if n.get("c"):
        cls = " ".join(n["c"].split())
        t += "." + cls.replace(" ", ".")
    if n.get("i"):
        t += "#" + n["i"]
    return t


def walk(n, depth, fn):
    fn(n, depth)
    for k in n.get("k", []):
        walk(k, depth + 1, fn)


def arg(args, name, default=None, cast=int):
    for a in args:
        if a.startswith(f"--{name}="):
            return cast(a.split("=", 1)[1])
    return default


def cmd_outline(args):
    y0, y1 = arg(args, "y0", 0), arg(args, "y1", 10**9)
    x0, x1 = arg(args, "x0", -10**9), arg(args, "x1", 10**9)
    maxd = arg(args, "depth", 20)
    skip = arg(args, "skip", None, str)
    rx = re.compile(skip) if skip else None
    lines = []

    def fn(n, depth):
        if depth > maxd:
            return
        x, y, w, h = n["r"]
        if y + h < y0 or y > y1 or x + w < x0 or x > x1:
            return
        ident = label(n)
        if rx and rx.search(ident):
            return
        line = f"{'  ' * depth}{ident} [{x},{y} {w}x{h}]"
        extra = short(n)
        if extra:
            line += f" {{{extra}}}"
        if n.get("x"):
            line += f' "{n["x"][:90]}"'
        if n["t"] == "img":
            line += f' <img {n.get("src", "")[:110]}>'
        lines.append(line)

    walk(DATA, 0, fn)
    print("\n".join(lines))


def find_all(n, needle, out):
    txt = (n.get("x") or "") + " " + (n.get("alt") or "")
    if needle.lower() in txt.lower():
        out.append(n)
    for k in n.get("k", []):
        find_all(k, needle, out)


def chain_to(n, target, trail):
    if n is target:
        return trail + [n]
    for k in n.get("k", []):
        r = chain_to(k, target, trail + [n])
        if r:
            return r
    return None


def cmd_find(args):
    hits = []
    find_all(DATA, args[0], hits)
    for h in hits:
        print(f"{label(h)} [{h['r']}] {short(h)} \"{h.get('x')}\"")


def cmd_path(args):
    hits = []
    find_all(DATA, args[0], hits)
    if not hits:
        print("no match")
        return
    for depth, n in enumerate(chain_to(DATA, hits[0], [])):
        print(f"{'  ' * depth}{label(n)} [{n['r']}] {short(n)}")


def cmd_sub(args):
    hits = []
    find_all(DATA, args[0], hits)
    if not hits:
        print("no match")
        return
    target = hits[0]
    # climb one or two levels for context
    chain = chain_to(DATA, target, [])
    start = chain[max(0, len(chain) - 3)]
    maxd = arg(args, "depth", 8)
    base = start["r"][1]
    lines = []

    def fn(n, depth):
        if depth > maxd:
            return
        x, y, w, h = n["r"]
        line = f"{'  ' * depth}{label(n)} [{x},{round(y - base)} {w}x{h}]"
        extra = short(n)
        if extra:
            line += f" {{{extra}}}"
        if n.get("x"):
            line += f' "{n["x"][:90]}"'
        if n["t"] == "img":
            line += f' <img {n.get("src", "")[:110]}>'
        lines.append(line)

    walk(start, 0, fn)
    print("\n".join(lines))


def cmd_cls(args):
    """Print full computed styles for nodes whose class/id contains the substring."""
    needle = args[0]
    limit = arg(args, "limit", 3)
    hits = []

    def fn(n, depth):
        ident = label(n)
        if needle in ident:
            hits.append(n)

    walk(DATA, 0, fn)
    for h in hits[:limit]:
        print("—" * 20)
        print(label(h), h["r"])
        for k, v in h.get("s", {}).items():
            print(f"  {k}: {v}")
        if h.get("x"):
            print(f'  text: "{h["x"]}"')
    print(f"({len(hits)} matches)")


if __name__ == "__main__":
    cmd = sys.argv[1]
    rest = sys.argv[2:]
    {"outline": cmd_outline, "find": cmd_find, "path": cmd_path, "sub": cmd_sub, "cls": cmd_cls}[cmd](rest)
