"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

export function CopyLinkButton({ url, label, copiedLabel }: { url: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="trn-button trn-button--action h-11 gap-2 px-6"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          /* clipboard unavailable */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
