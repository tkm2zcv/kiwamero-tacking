import pathlib

env = pathlib.Path("kiwamero-tracking/.env").read_text(encoding="utf-8")
out = ["# Local-only Worker secrets for `wrangler dev` (gitignored).",
       "# Generated from .env; do not commit.",
       "CRON_SECRET=local-dev-secret",
       "APP_URL=http://127.0.0.1:8788"]
for line in env.splitlines():
    s = line.strip()
    if s.startswith("HENRIK_API_KEY="):
        out.append(s)
path = pathlib.Path("kiwamero-tracking/.dev.vars")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
print("wrote .dev.vars with", len(out) - 2, "entries (values hidden)")
