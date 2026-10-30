"use client";

import Image from "next/image";
import Link from "next/link";
import { History, X } from "lucide-react";
import { useEffect, useState } from "react";
import { clearSearchHistory, getSearchHistory, type SearchHistoryEntry } from "@/lib/search-history";

/** Homepage "recent searches" strip — reads localStorage, renders nothing when empty. */
export function RecentSearches({ label, clearLabel }: { label: string; clearLabel: string }) {
  const [items, setItems] = useState<SearchHistoryEntry[]>([]);
  useEffect(() => {
    // localStorage is client-only — read after mount to avoid hydration drift.
    const id = setTimeout(() => setItems(getSearchHistory()), 0);
    return () => clearTimeout(id);
  }, []);
  if (!items.length) return null;
  return (
    <div className="mx-auto mt-8 max-w-2xl text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-13 text-secondary">
          <History className="size-4" />
          <span className="font-semibold">{label}</span>
        </div>
        <button
          type="button"
          onClick={() => {
            clearSearchHistory();
            setItems([]);
          }}
          className="inline-flex items-center gap-1 text-12 text-tertiary transition-colors hover:text-secondary"
        >
          <X className="size-3" />
          {clearLabel}
        </button>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        {items.map((e) => (
          <Link
            key={e.puuid ?? `${e.name}#${e.tag}`}
            href={`/valorant/profile/riot/${encodeURIComponent(e.name)}%23${encodeURIComponent(e.tag)}/overview`}
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-1.5"
            style={{ background: "var(--color-surface-1)" }}
          >
            {e.card ? (
              <Image
                src={e.card}
                alt=""
                width={32}
                height={32}
                loading="lazy"
                unoptimized
                style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", objectPosition: "center 25%" }}
              />
            ) : null}
            <span className="whitespace-nowrap text-13 font-medium text-primary">
              {e.name}
              <span className="text-tertiary">#{e.tag}</span>
            </span>
            {e.rankIcon ? (
              <Image src={e.rankIcon} alt={e.rankName ?? ""} width={20} height={20} loading="lazy" unoptimized />
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}
