"""Measure tracker.gg performance table row striping + episode label behavior."""
import pathlib, sys, json
sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
from scrapling.fetchers import StealthySession

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"

def action(page):
    page.wait_for_timeout(8000)
    data = page.evaluate("""() => {
      const items = [...document.querySelectorAll('.performance .st-content__item')];
      return items.slice(0, 16).map((el, i) => {
        const ep = el.querySelector('.st-entry-episode .info');
        const epVal = el.querySelector('.st-entry-episode .value');
        const cs = getComputedStyle(el);
        const first = el.querySelector('.st-content__item-value');
        return {
          i,
          cls: [...el.classList].join(' '),
          bg: cs.backgroundColor,
          firstCellBg: first ? getComputedStyle(first).backgroundColor : '',
          epText: epVal ? epVal.textContent : '(none)',
          epInfoShown: ep ? getComputedStyle(ep).display : '',
          // index among siblings
          idx: [...el.parentElement.children].indexOf(el),
          parentCls: el.parentElement.className,
        };
      });
    }""")
    print(json.dumps(data, indent=1), flush=True)

with StealthySession(headless=True) as session:
    session.fetch(
        "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/performance?platform=pc&playlist=competitive",
        network_idle=False, timeout=120000, wait=3000, page_action=action,
        viewport={"width": 1920, "height": 1080},
    )
print("ok", flush=True)
