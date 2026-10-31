"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import { clampImageCrop, FULL_IMAGE_CROP, type ImageSearchCrop } from "@/lib/image-search-core";
import type { Dict } from "@/lib/i18n/dict";

export function ImageSearchCropEditor({ image, crop, disabled, onChange, t }: {
  image: HTMLImageElement;
  crop: ImageSearchCrop;
  disabled: boolean;
  onChange: (crop: ImageSearchCrop) => void;
  t: Dict["search"];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const target = canvas.current!;
    const scale = Math.min(1, 560 / image.naturalWidth, 260 / image.naturalHeight);
    target.width = Math.max(1, Math.round(image.naturalWidth * scale));
    target.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = target.getContext("2d")!;
    ctx.drawImage(image, 0, 0, target.width, target.height);
    const x = crop.left / 100 * target.width, y = crop.top / 100 * target.height;
    const w = (crop.right - crop.left) / 100 * target.width;
    const h = (crop.bottom - crop.top) / 100 * target.height;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, target.width, y);
    ctx.fillRect(0, y + h, target.width, target.height - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, target.width - x - w, h);
    ctx.strokeStyle = "#3a86ff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, Math.max(1, w - 2), Math.max(1, h - 2));
    const zoom = preview.current!;
    const sw = image.naturalWidth * (crop.right - crop.left) / 100;
    const sh = image.naturalHeight * (crop.bottom - crop.top) / 100;
    const zoomScale = Math.min(4, 560 / sw, 160 / sh);
    zoom.width = Math.max(1, Math.round(sw * zoomScale));
    zoom.height = Math.max(1, Math.round(sh * zoomScale));
    zoom.getContext("2d")!.drawImage(image, image.naturalWidth * crop.left / 100,
      image.naturalHeight * crop.top / 100, sw, sh, 0, 0, zoom.width, zoom.height);
  }, [image, crop]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) };
  }

  function drag(event: PointerEvent<HTMLCanvasElement>) {
    if (!start.current || disabled) return;
    const end = point(event);
    if (Math.abs(end.x - start.current.x) < 1 || Math.abs(end.y - start.current.y) < 1) return;
    onChange(clampImageCrop({ left: Math.min(start.current.x, end.x), top: Math.min(start.current.y, end.y),
      right: Math.max(start.current.x, end.x), bottom: Math.max(start.current.y, end.y) }));
  }

  const labels = { left: t.imageLeft, right: t.imageRight, top: t.imageTop, bottom: t.imageBottom };
  return (
    <fieldset disabled={disabled} className="kt-image-crop">
      <legend>{t.imageCrop}</legend>
      <p className="text-sm text-secondary">{t.imageCropHint}</p>
      <canvas ref={canvas} aria-label={t.imageCrop} className="kt-image-crop-source"
        onPointerDown={(event) => {
          if (disabled || event.button !== 0) return;
          start.current = point(event);
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={drag}
        onPointerUp={(event) => { drag(event); start.current = null; }}
        onPointerCancel={() => { start.current = null; }}
      />
      <div className="kt-image-crop-controls">
        {(Object.keys(labels) as (keyof ImageSearchCrop)[]).map((key) => (
          <label key={key}>{labels[key]} <span>{Math.round(crop[key])}%</span>
            <input type="range" min={key === "right" ? Math.ceil(crop.left + 1) : key === "bottom" ? Math.ceil(crop.top + 1) : 0}
              max={key === "left" ? Math.floor(crop.right - 1) : key === "top" ? Math.floor(crop.bottom - 1) : 100}
              value={crop[key]} step="any"
              onChange={(event) => onChange(clampImageCrop({ ...crop, [key]: Number(event.target.value) }))} />
          </label>
        ))}
      </div>
      <button type="button" className="kt-image-link" onClick={() => onChange({ ...FULL_IMAGE_CROP })}>{t.imageFull}</button>
      <div className="kt-image-preview">
        <span className="text-xs text-secondary">{t.imagePreview}</span>
        <canvas ref={preview} aria-label={t.imagePreview} />
      </div>
    </fieldset>
  );
}
