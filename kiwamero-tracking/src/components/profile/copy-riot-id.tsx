"use client";

import { useEffect, useRef, useState } from "react";

export function CopyRiotId({ name, tag }: { name: string; tag: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  const riotId = `${name.trim()}#${tag.trim()}`;

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(riotId);
      } else {
        const input = document.createElement("textarea");
        input.value = riotId;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="kt-hero-copy"
      onClick={copy}
      title={copied ? "Copied" : `Copy ${riotId}`}
      aria-label={`Copy ${riotId}`}
    >
      <span className="kt-hero-name">{name}</span>
      <span className="kt-hero-tag">#{tag}</span>
      <span className={`kt-hero-copy__state${copied ? " kt-hero-copy__state--show" : ""}`} aria-live="polite">
        Copied
      </span>
    </button>
  );
}
