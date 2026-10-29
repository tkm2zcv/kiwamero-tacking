"""Stack reference and local screenshots for side-by-side review."""
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
OUT = ROOT / "docs" / "research" / "capture"


def crop_box(path, box, scale=2):
    im = Image.open(path)
    x0, y0, x1, y1 = box
    return im.crop((x0 * scale, y0 * scale, x1 * scale, y1 * scale))


def stack(name, box, width=1500):
    ref = crop_box(OUT / "ref-1920-full.png", box)
    loc = crop_box(OUT / "local-1920-full.png", box)
    w = width
    ratio = w / ref.width
    ref = ref.resize((w, int(ref.height * ratio)))
    loc = loc.resize((w, int(loc.height * ratio)))
    gap = 12
    canvas = Image.new("RGB", (w, ref.height + loc.height + gap), (255, 0, 0))
    canvas.paste(ref, (0, 0))
    canvas.paste(loc, (0, ref.height + gap))
    canvas.save(OUT / name)
    print(name, canvas.size)


if __name__ == "__main__":
    stack(sys.argv[1], tuple(int(x) for x in sys.argv[2:6]))
