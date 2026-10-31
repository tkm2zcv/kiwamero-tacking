"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImageIcon, Link2, LoaderCircle, Share2, X } from "lucide-react";
import type { ShareCardModel } from "@/lib/share-card-data";
import { renderShareCardImage, shareCardFileName } from "./share-image";

type ShareStatus = "idle" | "working" | "ready" | "saved" | "copied" | "image-copied" | "error";

function downloadBlob(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  document.execCommand("copy");
  area.remove();
}

export function ShareProfileButton({ card }: { card: ShareCardModel }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<ShareStatus>("idle");
  const [asset, setAsset] = useState<{ key: string; blob: Blob; url: string } | null>(null);
  const [pageUrl, setPageUrl] = useState("");
  const [canCopyImage, setCanCopyImage] = useState(false);
  const cardKey = JSON.stringify(card);
  const previewUrl = asset?.key === cardKey ? asset.url : "";
  const blob = asset?.key === cardKey ? asset.blob : null;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const requestRef = useRef(0);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    return () => {
      if (asset?.url) URL.revokeObjectURL(asset.url);
    };
  }, [asset]);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
        triggerRef.current?.focus();
      }
      return;
    }
    wasOpenRef.current = true;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !modalRef.current) return;
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
        ),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function openSharePanel() {
    setPageUrl(window.location.href);
    setCanCopyImage(
      typeof ClipboardItem !== "undefined" && typeof navigator.clipboard?.write === "function",
    );
    setOpen(true);
    if (blob && previewUrl) {
      setStatus("ready");
      return;
    }

    const request = ++requestRef.current;
    setStatus("working");
    try {
      const generated = await renderShareCardImage(card);
      if (request !== requestRef.current) return;
      const objectUrl = URL.createObjectURL(generated);
      setAsset({ key: cardKey, blob: generated, url: objectUrl });
      setStatus("ready");
    } catch {
      if (request === requestRef.current) setStatus("error");
    }
  }

  async function copyLink() {
    try {
      await copyText(pageUrl || window.location.href);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  }

  async function copyImage() {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setStatus("image-copied");
    } catch {
      setStatus("error");
    }
  }

  function downloadCard() {
    if (!blob) return;
    downloadBlob(blob, shareCardFileName(card));
    setStatus("saved");
  }

  const statusMessage = {
    idle: "",
    working: "Creating PNG card…",
    ready: "PNG card is ready.",
    saved: "PNG saved.",
    copied: "Profile link copied.",
    "image-copied": "Image copied.",
    error: "Could not complete the action.",
  }[status];

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="kt-icon-btn"
        aria-label="Share stats card"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Share stats card"
        onClick={openSharePanel}
      >
        <Share2 size={20} />
      </button>

      {open ? createPortal(
        <div
          className="kt-share-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section ref={modalRef} className="kt-share-modal" role="dialog" aria-modal="true" aria-labelledby="kt-share-title">
            <header className="kt-share-modal__header">
              <div>
                <p className="kt-share-modal__kicker">Share stats card</p>
                <h2 id="kt-share-title" className="kt-share-modal__title">
                  {card.name}<span>#{card.tag}</span>
                </h2>
                <p className="kt-share-modal__meta">{card.actLabel} · {card.playlistLabel}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="kt-share-modal__close"
                aria-label="Close share panel"
                onClick={() => setOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="kt-share-modal__preview" data-loading={status === "working"}>
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={`${card.name}#${card.tag} stats card preview`}
                  width={1400}
                  height={700}
                  unoptimized
                />
              ) : (
                <div className="kt-share-modal__placeholder">
                  {status === "working" ? <LoaderCircle className="kt-spin" size={28} /> : null}
                  <span>{status === "working" ? "Creating PNG card…" : "PNG preview unavailable"}</span>
                </div>
              )}
            </div>

            <div className="kt-share-modal__url" title={pageUrl}>{pageUrl}</div>

            <footer className="kt-share-modal__footer">
              <button
                type="button"
                className="kt-btn kt-btn--primary"
                disabled={!blob}
                onClick={downloadCard}
              >
                <Download size={16} />
                Download PNG
              </button>
              <button type="button" className="kt-btn kt-btn--secondary" onClick={copyLink}>
                <Link2 size={16} />
                Copy link
              </button>
              {canCopyImage ? (
                <button
                  type="button"
                  className="kt-btn kt-btn--outline"
                  disabled={!blob}
                  onClick={copyImage}
                >
                  <ImageIcon size={16} />
                  Copy image
                </button>
              ) : null}
              {status === "error" && !blob ? (
                <button type="button" className="kt-btn kt-btn--outline" onClick={openSharePanel}>
                  Retry
                </button>
              ) : null}
              <span className="kt-share-modal__status" role="status" aria-live="polite">{statusMessage}</span>
            </footer>
          </section>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
