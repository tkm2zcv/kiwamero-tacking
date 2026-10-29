"""Build src/app/trn-v3.css from real tracker.gg CSS rules (extracted via Scrapling).

Keeps rules whose selectors use the component classes we replicate, strips
[data-v-*] attribute selectors, and dedupes.
"""
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
SRC = [
    ROOT / "docs/research/capture/perf-rules.css",
    ROOT / "docs/research/capture/x-agents-rules.css",
    ROOT / "docs/research/capture/x-maps-rules.css",
    ROOT / "docs/research/capture/x-matches-rules.css",
    ROOT / "docs/research/capture/x-encounters-rules.css",
]
OUT = ROOT / "kiwamero-tracking/src/app/trn-v3.css"

# Selector prefixes we transplant (real tracker.gg component classes).
KEEP = (
    ".v3-card", ".v3-filter", ".v3-trnign", ".v3-chip", ".v3-separate",
    ".v3-match-row", ".v3-stat", ".v3-button", ".v3-grid",
    ".st", ".trn-mini-row", ".trn-list__item", ".trn-gamereport",
    ".performance", ".best-matches", ".agent-row", ".acquaintances",
    ".activity", ".day", ".trn-ign", ".value--", ".text-valorant",
)


def strip_attrs(selector: str) -> str:
    s = re.sub(r"\[data-v-[0-9a-f]+\]", "", selector)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def main() -> None:
    seen: set[str] = set()
    out: list[str] = []
    for path in SRC:
        if not path.exists():
            continue
        css = path.read_text(encoding="utf-8")
        for rule in re.findall(r"[^{}]+\{[^{}]*\}", css):
            sel_raw, body = rule.split("{", 1)
            sel = strip_attrs(sel_raw)
            if not sel or not any(k in sel for k in KEEP):
                continue
            cleaned = f"{sel} {{{body.rstrip(' }').strip()}}}"
            if cleaned not in seen:
                seen.add(cleaned)
                out.append(cleaned)
    header = """/* tracker.gg v3 component rules, extracted with Scrapling from the live site.
   Used by the profile tab tables (agents/maps/performance/encounters). */
:root {
  --color-surface-1: #0f1923;
  --color-surface-2: #1b2733;
  --color-surface-3: #2c3f52;
  --color-text-primary: #efefef;
  --color-text-secondary: #99abbf;
  --color-text-disabled: rgb(239 239 239 / 0.5);
  --color-action: #ff4655;
  --color-action-contrast: #efefef;
  --color-background: #0f141a;
  --color-rgb-surface-1: 15 25 35;
  --color-rgb-surface-2: 27 39 51;
  --color-rgb-surface-3: 44 63 82;
  --color-rgb-action: 255 70 85;
  --color-rgb-text-primary: 239 239 239;
  --color-rgb-text-secondary: 153 171 191;
  --color-rgb-text-tertiary: 102 114 128;
  --color-rgb-gold: 203 183 101;
  --v3-font-title: var(--kt-title);
  --v3-font-body: var(--kt-font);
}
"""
    OUT.write_text(header + "\n" + "\n".join(out) + "\n", encoding="utf-8")
    print(f"wrote {OUT} with {len(out)} rules")


if __name__ == "__main__":
    main()
