import { clampImageCrop, suggestImageCrop, type ImageSearchCrop } from "./image-search-core.ts";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;

export async function loadSearchImage(file: Blob): Promise<HTMLImageElement> {
  if (!file.type.startsWith("image/") || file.size > MAX_FILE_BYTES) throw new Error("invalid image");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight ||
        image.naturalWidth * image.naturalHeight > MAX_PIXELS) throw new Error("image dimensions");
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function suggestSearchImageCrop(image: HTMLImageElement): ImageSearchCrop {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return suggestImageCrop(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}

/** Upscale just the selected name, not a whole 4K scoreboard. Keep gray tags intact. */
export function prepareSearchImage(image: HTMLImageElement, crop: ImageSearchCrop): HTMLCanvasElement[] {
  const c = clampImageCrop(crop);
  const x = Math.floor(image.naturalWidth * c.left / 100);
  const y = Math.floor(image.naturalHeight * c.top / 100);
  const w = Math.max(1, Math.ceil(image.naturalWidth * c.right / 100) - x);
  const h = Math.max(1, Math.ceil(image.naturalHeight * c.bottom / 100) - y);
  const scale = Math.min(4, 1800 / w, 1000 / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const original = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return [false, true].map((binary) => {
    const output = document.createElement("canvas");
    output.width = canvas.width + 32;
    output.height = canvas.height + 32;
    const out = output.getContext("2d")!;
    out.fillStyle = "white";
    out.fillRect(0, 0, output.width, output.height);
    const data = out.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < original.data.length; i += 4) {
      const lum = 0.299 * original.data[i] + 0.587 * original.data[i + 1] + 0.114 * original.data[i + 2];
      const v = binary ? (lum > 100 ? 0 : 255) : 255 - lum;
      data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    out.putImageData(data, 16, 16);
    return output;
  });
}
