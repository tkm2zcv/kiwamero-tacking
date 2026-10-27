import { getDict } from "@/lib/i18n/server";
import type { Diagnosis } from "@/lib/types";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export async function DiagnosisPanel({ diagnosis }: { diagnosis: Diagnosis }) {
  const t = await getDict();
  const signals = [...(diagnosis.playerStats ?? []), ...(diagnosis.topCluster ?? [])];
  if (!signals.length) {
    return (
      <div className="trn-card p-8 text-center text-secondary">
        {t.diagnosis.title}: data not available for this player yet.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="trn-card p-4">
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-tertiary">{t.diagnosis.title}</h3>
        <p className="text-sm text-secondary">Automated analysis of account history, rank trajectory and match patterns.</p>
      </div>
      {signals.map((s, i) => (
        <div key={i} className="trn-card flex gap-3 p-4">
          <SeverityIcon s={s.severity ?? s.type ?? "neutral"} />
          <div>
            <div className="font-semibold">{s.title}</div>
            <p className="mt-1 text-sm text-secondary">{s.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function SeverityIcon({ s }: { s: string }) {
  if (s === "alert" || s === "high") return <AlertTriangle className="size-5 shrink-0" style={{ color: "var(--color-action)" }} />;
  if (s === "warn" || s === "suspicious") return <AlertTriangle className="size-5 shrink-0 text-yellow-400" />;
  if (s === "normal" || s === "good") return <CheckCircle2 className="size-5 shrink-0" style={{ color: "var(--color-valorant-team-1)" }} />;
  return <Info className="size-5 shrink-0" style={{ color: "var(--color-tier-s)" }} />;
}
