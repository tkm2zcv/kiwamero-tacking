"use client";

import { useEffect, useState } from "react";
import { BellRing, Check, Send, Trash2 } from "lucide-react";

type Status = { configured: boolean; masked: string | null; updatedAt: string | null };

export function WatchlistWebhook() {
  const [status, setStatus] = useState<Status | null>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/watchlist/webhook")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data) setStatus(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/watchlist/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(false);
    if (!res?.ok) {
      setMessage({ kind: "error", text: data?.message ?? "Could not save this webhook URL." });
      return;
    }
    setUrl("");
    setStatus({ configured: true, masked: data.masked, updatedAt: new Date().toISOString() });
    setMessage({
      kind: "ok",
      text: data.delivered ? `Saved. Delivered ${data.delivered} recent match(es).` : "Saved. New matches will be delivered hourly.",
    });
  }

  async function remove() {
    setBusy(true);
    await fetch("/api/watchlist/webhook", { method: "DELETE" }).catch(() => null);
    setBusy(false);
    setStatus({ configured: false, masked: null, updatedAt: null });
    setMessage({ kind: "ok", text: "Webhook removed." });
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/watchlist/webhook/test", { method: "POST" }).catch(() => null);
    setBusy(false);
    setMessage(
      res?.ok
        ? { kind: "ok", text: "Test message sent — check your Discord channel." }
        : { kind: "error", text: "Discord rejected the test message. Re-check the webhook URL." },
    );
  }

  return (
    <section className="kt-card" aria-label="Discord notifications">
      <header className="kt-card-head">
        <h2 className="kt-card-title">Discord Notifications</h2>
        <p className="kt-card-desc">Hourly match alerts for the players you watch</p>
      </header>
      <div className="kt-card-body" style={{ padding: 16, gap: 12 }}>
        {status?.configured ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--kt-green)" }}>
              <Check size={16} /> Connected
            </span>
            <code className="text-xs" style={{ color: "var(--kt-text-2)" }}>{status.masked}</code>
            <button type="button" className="kt-btn kt-btn--sm kt-btn--secondary" onClick={test} disabled={busy}>
              <Send size={14} /> Send test
            </button>
            <button type="button" className="kt-btn kt-btn--sm" onClick={remove} disabled={busy}>
              <Trash2 size={14} /> Remove
            </button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--kt-text-2)" }}>
            Add a Discord webhook to get a message when a watched player finishes a match. The newest match is sent
            immediately, then every new match is checked hourly.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className="h-10 min-w-0 flex-1 rounded-[4px] px-3 text-sm outline-none"
            style={{ background: "var(--kt-surface-2)", border: "1px solid var(--kt-surface-3)", color: "var(--kt-text)" }}
            aria-label="Discord webhook URL"
          />
          <button type="button" className="kt-btn kt-btn--primary" onClick={save} disabled={busy || !url.trim()}>
            <BellRing size={16} /> {status?.configured ? "Replace" : "Save"}
          </button>
        </div>

        {message ? (
          <p className="text-xs" style={{ color: message.kind === "ok" ? "var(--kt-green)" : "var(--kt-red)" }}>
            {message.text}
          </p>
        ) : null}
        <p className="text-xs" style={{ color: "var(--kt-dim)" }}>
          Only <code>discord.com/api/webhooks/…</code> URLs are accepted. The URL is stored server-side and never shown
          again in full.
        </p>
      </div>
    </section>
  );
}
