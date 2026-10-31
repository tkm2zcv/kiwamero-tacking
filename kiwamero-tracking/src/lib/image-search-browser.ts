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

/** PaddleOCR reads color text lines; do not threshold away glyphs or rewrite spacing. */
export async function prepareSearchImage(image: HTMLImageElement, crop: ImageSearchCrop): Promise<ArrayBuffer> {
  const c = clampImageCrop(crop);
  const x = Math.floor(image.naturalWidth * c.left / 100);
  const y = Math.floor(image.naturalHeight * c.top / 100);
  const w = Math.max(1, Math.ceil(image.naturalWidth * c.right / 100) - x);
  const h = Math.max(1, Math.ceil(image.naturalHeight * c.bottom / 100) - y);
  const scale = Math.min(4, 1800 / w, 1000 / h);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, x, y, w, h, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image encoding failed")), "image/png"));
  return blob.arrayBuffer();
}
