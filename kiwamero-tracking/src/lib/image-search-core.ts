export interface RiotIdCandidate {
  name: string;
  tag: string;
}

export interface ImageSearchCandidates {
  pairs: RiotIdCandidate[];
  names: string[];
}

/** Do not normalize the player's name: width, symbols and spaces can be identity. */
export function parseImageRiotId(value: string): RiotIdCandidate | null {
  const parts = value.trim().split(/[#＃﹟]/u);
  if (parts.length !== 2) return null;
  const [name, tag] = parts.map((part) => part.trim());
  if (!name || [...name].length > 30 || /[\p{C}]/u.test(name)) return null;
  if (!/^[\p{L}\p{N}\p{M}]{2,6}$/u.test(tag)) return null;
  return { name, tag };
}

export function imageSearchProfilePath({ name, tag }: RiotIdCandidate): string {
  return `/valorant/profile/riot/${encodeURIComponent(`${name}#${tag}`)}/overview`;
}

/** Extract whole lines, never a plausible-looking suffix of an unsupported ID. */
export function extractImageCandidates(texts: readonly string[]): ImageSearchCandidates {
  const pairs: RiotIdCandidate[] = [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    for (const line of text.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)) {
      const parts = line.split(/[#＃﹟]/u);
      // OCR often inserts spaces in tags. Name spaces remain visible for review.
      const pair = parts.length === 2
        ? parseImageRiotId(`${parts[0]}#${parts[1].replace(/\s+/gu, "")}`)
        : null;
      if (pair) {
        const key = `${pair.name}#${pair.tag}`.toLowerCase();
        if (!seen.has(key) && pairs.length < 12) pairs.push(pair);
        seen.add(key);
      } else if (parts.length === 1 && [...line].length <= 30 && /[\p{L}\p{N}]/u.test(line)) {
        const key = `name:${line.toLowerCase()}`;
        if (!seen.has(key) && names.length < 8) names.push(line);
        seen.add(key);
      }
    }
  }
  return { pairs, names };
}

/** Percentage bounds keep pointer selection and keyboard sliders in sync. */
export interface ImageSearchCrop {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export const FULL_IMAGE_CROP: ImageSearchCrop = { left: 0, top: 0, right: 100, bottom: 100 };

export function clampImageCrop(crop: ImageSearchCrop): ImageSearchCrop {
  const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
  const left = Math.max(0, Math.min(99, finite(crop.left, 0)));
  const top = Math.max(0, Math.min(99, finite(crop.top, 0)));
  return {
    left, top,
    right: Math.max(left + 1, Math.min(100, finite(crop.right, 100))),
    bottom: Math.max(top + 1, Math.min(100, finite(crop.bottom, 100))),
  };
}

/** Suggest a dark horizontal tooltip; the user always sees and can adjust it. */
export function suggestImageCrop(
  pixels: ArrayLike<number>, width: number, height: number,
): ImageSearchCrop {
  let start = -1;
  let best: { top: number; bottom: number; score: number } | null = null;
  let score = 0;
  for (let y = 0; y <= height; y++) {
    let dark = 0;
    if (y < height) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] > 200 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 45) dark++;
      }
    }
    if (dark / width > 0.2) {
      if (start < 0) start = y;
      score += dark;
    } else if (start >= 0) {
      const h = y - start;
      if (h >= 12 && h <= height * 0.6 && width / h >= 3 && (!best || score > best.score)) {
        best = { top: start, bottom: y, score };
      }
      start = -1;
      score = 0;
    }
  }
  if (!best) return { ...FULL_IMAGE_CROP };
  let left = width, right = 0;
  for (let x = 0; x < width; x++) {
    let dark = 0;
    for (let y = best.top; y < best.bottom; y++) {
      const i = (y * width + x) * 4;
      if (Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 45) dark++;
    }
    if (dark / (best.bottom - best.top) > 0.2) {
      left = Math.min(left, x);
      right = x + 1;
    }
  }
  return clampImageCrop({
    left: Math.max(0, left - 2) / width * 100, right: Math.min(width, right + 2) / width * 100,
    top: Math.max(0, best.top - 2) / height * 100, bottom: Math.min(height, best.bottom + 2) / height * 100,
  });
}
