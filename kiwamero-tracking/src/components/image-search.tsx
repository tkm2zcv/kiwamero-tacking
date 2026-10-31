"use client";

import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, useId } from "react";
import { createPortal } from "react-dom";
import type { Dict } from "@/lib/i18n/dict";
import { ImageSearchCropEditor } from "./image-search-crop";
import { ImageSearchResults } from "./image-search-results";
import { useImageSearch } from "./use-image-search";

export type ImageSearchDict = Dict["search"];
const EMPTY_RESULT = { pairs: [], names: [] };

export function ImageSearchButton({ t }: { t: ImageSearchDict }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const search = useImageSearch();
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const panel = dialog.current!;
    const triggerButton = trigger.current;
    panel.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      panel.close();
      document.body.style.overflow = overflow;
      triggerButton?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.items ?? [])]
        .find((item) => item.type.startsWith("image/"))?.getAsFile();
      if (file) { event.preventDefault(); void search.select(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, search]);

  function close() {
    search.reset();
    setOpen(false);
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        title={t.imageCta}
        aria-label={t.imageCta}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="flex h-14 w-14 items-center justify-center rounded-xl"
        style={{ background: "var(--color-surface-1)", border: "2px solid var(--color-surface-3)", color: "var(--color-action)" }}
      >
        <ImagePlus className="size-5" />
      </button>
      {open && createPortal(
        <dialog ref={dialog} className="kt-image-dialog" aria-labelledby={titleId}
          onCancel={(event) => { event.preventDefault(); close(); }}
          onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className="kt-image-panel">
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="font-bold">{t.imageTitle}</h2>
              <button type="button" onClick={close} className="text-tertiary" aria-label={t.imageCancel}>
                <X className="size-5" />
              </button>
            </div>

            <p className="mt-2 text-sm text-secondary">{t.imagePrivacy}</p>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/bmp"
              className="hidden" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void search.select(file);
                event.target.value = "";
              }} />
            <button type="button" className="kt-image-drop" onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()} onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void search.select(file);
              }}>{t.imageDrop}</button>
            {search.image && <ImageSearchCropEditor image={search.image} crop={search.crop}
              disabled={search.busy} onChange={search.changeCrop} t={t} />}
            {search.image && <button type="button" className="trn-button trn-button--action mt-4"
              disabled={search.busy} onClick={() => void search.read()}>{t.imageRead}</button>}
            {search.busy && <p role="status" className="kt-image-status">
              <Loader2 className="size-5 animate-spin" />
              {t.imageReading.replace("{pct}", String(search.progress))}
            </p>}
            {search.error && <p role="alert" className="kt-image-error">
              {search.error === "image" ? t.imageInvalidFile : t.imageFailure}
            </p>}

            {(search.result || search.error === "ocr") && <ImageSearchResults result={search.result ?? EMPTY_RESULT} t={t}
              navigate={(path) => { close(); router.push(path); }} />}
          </div>
        </dialog>, document.body)}
    </>
  );
}
