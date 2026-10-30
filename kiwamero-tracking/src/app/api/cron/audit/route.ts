import { runAuditQueue } from "@/lib/audit-run";
import { cronAuthorized } from "@/lib/cron-auth";
import { apiKeys } from "@/lib/henrik-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!cronAuthorized(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!apiKeys().length) return Response.json({ error: "upstream_not_configured" }, { status: 503 });
  try {
    return Response.json({ ok: true, ...await runAuditQueue() });
  } catch {
    return Response.json({ error: "analysis_worker_unavailable" }, { status: 503 });
  }
}
