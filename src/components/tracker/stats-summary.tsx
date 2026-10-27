import { ClipboardCopy } from "lucide-react";

interface Summary {
  winRate: number;
  matches: number;
  wins: number;
  losses: number;
  kd: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  hs: number;
}

export function StatsSummary({ s }: { s: Summary }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm">
          <span className="text-muted-foreground">勝率 ({s.matches}試合) </span>
          <span className="text-2xl font-black text-foreground">{s.winRate}%</span>
          <span className="ml-2 text-sm text-muted-foreground">
            {s.wins}勝 {s.losses}敗
          </span>
        </p>
        <button className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-secondary/70 transition-colors">
          <ClipboardCopy className="h-3.5 w-3.5" />
          AA戦績コピー (直近20)
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatBlock label="K/D 比" value={s.kd.toFixed(2)} sub={`${s.kills} / ${s.deaths} / ${s.assists}`} big />
        <StatBlock label="平均 ACS" value={String(s.acs)} sub="スコア/ラウンド" big />
        <StatBlock label="平均 ADR" value={String(s.adr)} sub="ダメージ/ラウンド" big />
        <StatBlock label="ヘッドショット率" value={`${s.hs}%`} sub="総弾数中" big />
      </div>
    </div>
  );
}

function StatBlock({ label, value, sub, big }: { label: string; value: string; sub: string; big?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-black tabular-nums ${big ? "text-2xl text-emerald-400" : "text-lg"}`}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}
