import { ShieldCheck, Radar, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuditItem {
  type?: string;
  category?: string;
  severity?: string;
  title: string;
  description: string;
}

export function AppraisalTab({ items }: { items: AuditItem[] }) {
  return (
    <DiagnosisPanel
      heading="アカウント査定"
      sub="アカウントの市場価値に関わる要素を自動評価します"
      items={items}
      icon={<ShieldCheck className="h-5 w-5 text-cyan-400" />}
    />
  );
}

export function SmurfTab({ items }: { items: AuditItem[] }) {
  return (
    <DiagnosisPanel
      heading="スマーフ診断"
      sub="統計パターンからスマーフ・代行・共有アカウントの兆候を検出します"
      items={items}
      icon={<Radar className="h-5 w-5 text-cyan-400" />}
    />
  );
}

function DiagnosisPanel({
  heading,
  sub,
  items,
  icon,
}: {
  heading: string;
  sub: string;
  items: AuditItem[];
  icon: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/60 bg-secondary/40">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-bold">{heading}</h3>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        </div>
      </div>
      {items.map((it, i) => {
        const warn = (it.severity ?? it.type) === "warning" || (it.severity ?? it.type) === "danger";
        const neutral = (it.severity ?? it.type) === "neutral";
        return (
          <div key={i} className="flex gap-3.5 rounded-xl border border-border/60 bg-card p-4">
            <span
              className={cn(
                "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                warn ? "bg-amber-400/15 text-amber-400" : neutral ? "bg-cyan-400/15 text-cyan-400" : "bg-emerald-400/15 text-emerald-400"
              )}
            >
              {warn ? <AlertTriangle className="h-4 w-4" /> : neutral ? <Info className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </span>
            <div>
              <p className="text-sm font-bold">{it.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{it.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
