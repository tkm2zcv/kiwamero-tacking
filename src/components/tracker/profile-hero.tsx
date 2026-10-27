import Image from "next/image";
import { Star, RefreshCw, Share2 } from "lucide-react";
import { CARD_ART } from "@/lib/utils";

interface Props {
  name: string;
  tag: string;
  level: number;
  region: string;
  cardId: string;
  lastUpdated: string;
}

export function ProfileHero({ name, tag, level, region, cardId, lastUpdated }: Props) {
  return (
    <div className="bg-card border-border relative mb-12 w-full overflow-hidden rounded-2xl border shadow-2xl shadow-black/40">
      <div className="absolute inset-0">
        <Image
          src={CARD_ART(cardId, "wideart")}
          alt="player card banner"
          fill
          className="object-cover object-center opacity-80"
          sizes="1200px"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/70 via-background/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background/80 to-transparent" />
      </div>
      <div className="relative flex flex-col gap-4 p-6 pt-16 sm:flex-row sm:items-end sm:justify-between sm:p-8 sm:pt-24">
        <div className="flex items-end gap-5">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border-4 border-background/60 bg-card shadow-xl">
            <Image
              src={CARD_ART(cardId, "smallart")}
              alt={name}
              fill
              className="object-cover"
              sizes="96px"
              priority
            />
          </div>
          <div className="pb-1">
            <div className="flex items-baseline gap-1.5">
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{name}</h1>
              <span className="text-xl font-bold text-muted-foreground">#{tag}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-md border border-border/70 bg-background/50 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                Lvl. {level}
              </span>
              <span className="rounded-md border border-border/70 bg-background/50 px-2 py-0.5 text-xs font-semibold uppercase text-muted-foreground">
                {region}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur hover:bg-secondary/70 transition-colors">
              <Star className="h-3.5 w-3.5" />
              監視対象に追加
            </button>
            <button className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-card/70 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur hover:bg-secondary/70 transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              最新戦績を取得
            </button>
            <button className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground shadow-lg hover:brightness-95 transition-all">
              <Share2 className="h-3.5 w-3.5" />
              戦績カードを共有
            </button>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              Last Updated
            </p>
            <p className="text-xs font-semibold text-foreground/80">{lastUpdated}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
