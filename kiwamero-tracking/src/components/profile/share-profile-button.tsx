"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

export function ShareProfileButton() {
  const [copied, setCopied] = useState(false);

  async function shareProfile() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className="kt-icon-btn"
      aria-label="Share profile"
      title={copied ? "Link copied" : "Share profile"}
      onClick={shareProfile}
    >
      <Share2 size={20} />
      <span className="sr-only" aria-live="polite">{copied ? "Link copied" : ""}</span>
    </button>
  );
}
