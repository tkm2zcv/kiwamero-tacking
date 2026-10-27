"use client";

import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onChange: (p: number) => void;
}) {
  const pages: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p <= 3 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  const btn =
    "flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg border border-border/60 bg-card px-2.5 text-xs font-medium text-foreground/80 hover:bg-secondary/60 transition-colors disabled:opacity-40";
  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        <button className={btn} disabled={page === 1} onClick={() => onChange(1)} aria-label="最初">
          <ChevronsLeft className="h-4 w-4" />
        </button>
        <button className={btn} disabled={page === 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft className="h-4 w-4" /> 前へ
        </button>
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`e${i}`} className="px-1 text-muted-foreground">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={cn(btn, p === page && "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              {p}
            </button>
          )
        )}
        <button className={btn} disabled={page === totalPages} onClick={() => onChange(page + 1)}>
          次へ <ChevronRight className="h-4 w-4" />
        </button>
        <button className={btn} disabled={page === totalPages} onClick={() => onChange(totalPages)} aria-label="最後">
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        全 <strong className="text-foreground">{total}</strong> 試合中{" "}
        {(page - 1) * perPage + 1}〜{Math.min(page * perPage, total)} 件を表示中（ページ {page} / {totalPages}）
      </p>
    </div>
  );
}
