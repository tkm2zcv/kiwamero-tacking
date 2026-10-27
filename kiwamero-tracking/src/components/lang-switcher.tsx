"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export function LangSwitcher() {
  const { locale, t } = useT();
  const router = useRouter();
  const next = locale === "en" ? "ja" : "en";

  function switch_() {
    document.cookie = `lang=${next};path=/;max-age=31536000`;
    router.refresh();
  }

  return (
    <button
      onClick={switch_}
      className="trn-button h-9 px-3 text-xs"
      title={t.lang.label}
      aria-label={t.lang.label}
    >
      <Languages className="size-4" />
      {t.lang[next]}
    </button>
  );
}
