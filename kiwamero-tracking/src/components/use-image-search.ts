"use client";

import { useEffect, useRef, useState } from "react";
import { FULL_IMAGE_CROP, extractImageCandidates, type ImageSearchCandidates, type ImageSearchCrop } from "@/lib/image-search-core";
import { loadSearchImage, prepareSearchImage, suggestSearchImageCrop } from "@/lib/image-search-browser";
import { ImageSearchSession } from "@/lib/image-search-session";
import { createPaddleOcrClient, type PaddleOcrClient, type PaddleProgress } from "@/lib/image-search-paddle";

export function useImageSearch() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<ImageSearchCrop>(FULL_IMAGE_CROP);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<PaddleProgress["stage"]>("reading");
  const [result, setResult] = useState<ImageSearchCandidates | null>(null);
  const [error, setError] = useState<"image" | "ocr" | null>(null);
  const session = useRef(new ImageSearchSession<PaddleOcrClient>());
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
    setStage("reading");
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
    setStage("loading");
    const timeout = window.setTimeout(() => {
      if (revision.current !== request) return;
      cancel();
      setBusy(false);
      setError("ocr");
    }, 180_000);
    try {
      const input = await prepareSearchImage(image, crop);
      if (request !== revision.current) return;
      const found = await session.current.run(async (signal) => {
        signal.throwIfAborted();
        return createPaddleOcrClient((update) => {
          if (signal.aborted || revision.current !== request) return;
          setStage(update.stage);
          setProgress(Math.max(0, Math.min(100, Math.round(update.loaded / update.total * 100))));
        });
      }, async (worker, signal) => {
        await worker.load();
        signal.throwIfAborted();
        return extractImageCandidates(await worker.recognize(input));
      });
      if (found && request === revision.current) setResult(found);
    } catch {
      if (request === revision.current) setError("ocr");
    } finally {
      window.clearTimeout(timeout);
      if (request === revision.current) setBusy(false);
    }
  }

  return { image, crop, busy, progress, stage, result, error, select, changeCrop, read, reset };
}
