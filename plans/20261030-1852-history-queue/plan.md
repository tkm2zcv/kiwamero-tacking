# Shared Henrik Budget And Historical Audit

- Scope: existing authorized key pool; no deployment, secret changes or bulk live
  ingestion in this task. Preserve prior report UI/logic and search-history work.
- Per-key rolling-minute quotas default to the observed Standard 30 rpm, with
  background capped at 20 to reserve foreground capacity. Optional shared scope
  for keys whose provider quotas are shared; independent quotas require operator
  verification, not just multiplying key count.
- D1 atomic quota reservations and cooldowns are shared by every upstream caller.
- Persistent, minimal match-detail cache doubles as a leased durable work queue.
  Deduplicate match IDs across players; bounded retries and unavailable states.
- Public opt-in historical analysis: trusted upstream stored IDs only, same-origin
  POST, IP limit and global admission cap; status polling never calls upstream.
- Minute cron drains a bounded slice; hourly watch notifications retain their
  original schedule. Never invoke notifications during verification.
- Scan all retrieved Competitive history with adjacent 20-match windows.
  Show change candidates, comparable windows, cached roster/party coverage and
  unexamined ranges; never establish ownership from public data.

## Completed
1. Additive schema/migration, shared atomic quota and durable match cache.
2. Existing HTTP/detail consumers use shared controls; browser helpers separated.
3. Durable admission/status/runner, recovery and independent audit cron route.
4. Adjacent-window analysis, provisional status and per-ACT/date coverage UI.
5. Manual review, real-SQL concurrency/recovery/priority/retry tests, browser
   checks and README/architecture/deployment/changelog/handoff documentation.

## Verification
- `npm run check`: lint/typecheck/140 tests/Next build, exit0.
- `npm run build:worker`: OpenNext bundle, exit0.
- EN/JA assessment and diagnosis at1920/390/360px: no overflow/page errors.
- Pending/partial and ACT coverage tested using intercepted UI calls, not bulk
  live ingestion. Body/origin/ID guards verified locally.
- Client bundle:18 JS files; zero configured credential literals or DB markers.
- New SQL applied to LOCAL D1 and SQLite only. Existing unrelated work preserved.
- Evidence logs: app `.build-tmp/history-final-check.log`,
  `history-final-worker.log`, `history-browser.log`, `history-bundle-scan.log`.
- Detailed review: [report](../../docs/reports/20261030-history-queue-review.md).

## Production Gates
- Confirm independent provider budgets or configure shared scope; confirm
  retention rules. Four local credentials were counted, never printed.
- Approve production schema/secret/config deployment separately.
- Validate Workers Paid CPU/D1 query allowances, capacity, costs and WAF rules.
- No production changes, bulk live ingestion, notifications, commit or push.
