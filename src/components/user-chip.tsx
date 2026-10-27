import Image from "next/image";
import { ChevronDown } from "lucide-react";

export function UserChip() {
  return (
    <button className="flex items-center gap-2 rounded-full border border-border/60 bg-card/60 py-1 pl-1 pr-2.5 text-sm font-medium hover:bg-secondary/60 transition-colors">
      <span className="relative h-7 w-7 overflow-hidden rounded-full border border-border/60">
        <Image
          src="https://cdn.discordapp.com/avatars/798460499725254667/63e6fbe918e424759de2a16c645d3890.png"
          alt="user"
          fill
          className="object-cover"
          sizes="28px"
        />
      </span>
      tk
      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
    </button>
  );
}
