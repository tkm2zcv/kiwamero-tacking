"use client";

import { useEffect, useRef, useState } from "react";
import type { Worker } from "tesseract.js";
import { FULL_IMAGE_CROP, extractImageCandidates, type ImageSearchCandidates, type ImageSearchCrop } from "@/lib/image-search-core";
import { loadSearchImage, prepareSearchImage, suggestSearchImageCrop } from "@/lib/image-search-browser";
import { ImageSearchSession } from "@/lib/image-search-session";

export function useImageSearch() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<ImageSearchCrop>(FULL_IMAGE_CROP);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImageSearchCandidates | null>(null);
  const [error, setError] = useState<"image" | "ocr" | null>(null);
  const session = useRef(new ImageSearchSession<Worker>());
  const revision = useRef(0);

  function cancel() {
    revision.current++;
    session.current.cancel();
  }

  useEffect(() => {
    const job = session.current;
    const requests = revision;
    return () => { requests.current++; job.cancel(); };
  }, []);

  function reset() {
    cancel();
    setImage(null);
    setResult(null);
    setError(null);
    setBusy(false);
    setProgress(0);
  }

  async function select(file: Blob) {
    reset();
    const request = revision.current;
    setBusy(true);
    try {
      const loaded = await loadSearchImage(file);
      if (request !== revision.current) return;
      setCrop(suggestSearchImageCrop(loaded));
      setImage(loaded);
    } catch {
      if (request === revision.current) setError("image");
    } finally {
      if (request === revision.current) setBusy(false);
    }
  }

  function changeCrop(next: ImageSearchCrop) {
    cancel();
    setBusy(false);
    setCrop(next);
    setResult(null);
    setError(null);
  }

  async function read() {
    if (!image) return;
    cancel();
    const request = revision.current;
    setBusy(true);
    setProgress(0);
    setError(null);
    setResult(null);
    let pass = 0;
    const timeout = window.setTimeout(() => {
      if (revision.current !== request) return;
      cancel();
      setBusy(false);
      setError("ocr");
    }, 90_000);
    try {
      const variants = prepareSearchImage(image, crop);
      const found = await session.current.run(async (signal) => {
        const { createWorker } = await import("tesseract.js");
        signal.throwIfAborted();
        let fail: (reason: unknown) => void = () => {};
        const failed = new Promise<Worker>((_resolve, reject) => { fail = reject; });
        const ready = createWorker(["jpn", "eng"], 1, {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0",
          logger: ({ status, progress }) => {
            if (!signal.aborted && revision.current === request && status === "recognizing text") {
              setProgress(Math.round((pass + progress) / variants.length * 100));
            }
          },
          errorHandler: fail,
        });
        // A worker that becomes ready after a failed/cancelled initialization still needs disposal.
        void ready.then((worker) => {
          if (signal.aborted) void worker.terminate().catch(() => {});
        }, () => {});
        return Promise.race([ready, failed]);
      }, async (worker, signal) => {
        const { PSM } = await import("tesseract.js");
        const aspect = image.naturalWidth * (crop.right - crop.left) /
          (image.naturalHeight * (crop.bottom - crop.top));
        await worker.setParameters({ tessedit_pageseg_mode: aspect >= 3 ? PSM.SINGLE_LINE : PSM.SPARSE_TEXT });
        const texts: string[] = [];
        for (const variant of variants) {
          signal.throwIfAborted();
          texts.push((await worker.recognize(variant)).data.text);
          pass++;
        }
        return extractImageCandidates(texts);
      });
      if (found && request === revision.current) setResult(found);
    } catch {
      if (request === revision.current) setError("ocr");
    } finally {
      window.clearTimeout(timeout);
      if (request === revision.current) setBusy(false);
    }
  }

  return { image, crop, busy, progress, result, error, select, changeCrop, read, reset };
}
