import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ size = "md", glow = false }: { size?: "sm" | "md" | "lg"; glow?: boolean }) {
  const px = size === "lg" ? 96 : size === "md" ? 24 : 20;
  return (
    <span
      className={cn(
        "relative inline-block shrink-0",
        glow && "drop-shadow-[0_0_24px_rgba(59,130,246,0.55)]"
      )}
      style={{ width: px, height: px }}
    >
      <Image
        src="/brand/logo.webp"
        alt="KiwameroTracker"
        fill
        sizes="100vw"
        className="object-contain"
      />
    </span>
  );
}

export function Wordmark() {
  return (
    <span className="font-black tracking-tight text-foreground">KiwameroTracker</span>
  );
}
