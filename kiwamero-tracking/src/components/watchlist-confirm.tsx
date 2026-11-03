"use client";

import { LoaderCircle, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export function WatchlistConfirmDialog({
  open,
  playerLabel,
  title,
  body,
  confirmLabel,
  cancelLabel,
  busyLabel,
  closeLabel,
  busy = false,
  error = "",
  onCancel,
  onConfirm,
}: {
  open: boolean;
  playerLabel: string;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  busyLabel: string;
  closeLabel: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busy) onCancel();
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
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div
      className="kt-share-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={modalRef}
        className="kt-share-modal kt-share-modal--confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="kt-share-modal__header">
          <div>
            <p className="kt-share-modal__kicker">Watchlist</p>
            <h2 id={titleId} className="kt-share-modal__title">{title}</h2>
            <p className="kt-share-modal__meta">{playerLabel}</p>
          </div>
          <button
            type="button"
            className="kt-share-modal__close"
            aria-label={closeLabel}
            disabled={busy}
            onClick={onCancel}
          >
            <X size={20} />
          </button>
        </header>

        <p className="kt-confirm-copy">{body}</p>
        {error ? <p className="kt-confirm-error" role="alert">{error}</p> : null}

        <footer className="kt-share-modal__footer kt-confirm-actions">
          <button
            ref={cancelRef}
            type="button"
            className="trn-button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="trn-button trn-button--action"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? <LoaderCircle className="kt-spin" size={16} /> : null}
            {busy ? busyLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
