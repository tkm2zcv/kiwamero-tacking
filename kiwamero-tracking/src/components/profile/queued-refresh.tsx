"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function QueuedRefresh({ active, intervalMs = 20_000, maxTicks = 6 }: {
  active: boolean;
  intervalMs?: number;
  maxTicks?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      router.refresh();
      if (ticks >= maxTicks) clearInterval(timer);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, maxTicks, router]);
  return null;
}
