# HenrikDev Pool And Historical Enrichment

Status: local implementation; not deployed. No production DB/secret changes,
live bulk ingestion, watch-cycle execution, commit or push in this task.
Plan: [history queue](../../plans/20261030-1852-history-queue/plan.md).

## Acquisition

- Existing `HENRIK_API_KEYS` and legacy `HENRIK_API_KEY` merge/deduplicate.
  Four local credentials were confirmed by count only; values remain private.
- Every upstream request reserves a rolling-minute slot through D1. Default:
  30/key/min, background at most20, leaving10 for search/watch. These are
  configured limits matching the observed Standard plan, not measured capacity.
- `HENRIK_QUOTA_SCOPE=shared` uses one provider/account budget for all keys.
  Independent mode can provision120/min across four keys, background80/min.
  Provider independence has NOT been verified by a live throughput test.
- 429 honors numeric/HTTP-date Retry-After (default60s); 401 cools a bad key for
  five minutes and tries another. 403 never rotates to evade a privacy refusal.
  Exhausted/cooling keys are never forced; absent credentials/storage fail closed.
- Memory/colo caching and local in-flight sharing remain for profile endpoints.
  Immutable match metadata/rosters/stats are persisted in `MatchArchive` and
  shared across players/isolates. Round/event/economy blobs are not retained.
- Cache admission checks raw required statistics, identity, ended metadata and
  complete Competitive teams/rounds. Missing required numbers cannot become
  fabricated zero-valued cache entries. Successful details are not TTL-refetched.

## Durable Queue

- Public, explicit start: `POST /api/valorant/audit/{puuid}`. Same-origin, 2KiB
  body limit, per-IP3/min best-effort limit; Riot ID must resolve to that PUUID.
  Match IDs come from upstream Competitive history, not arbitrary client input.
- Atomic admission: at most20 active players; per-player max5,000 valid rows and
  1.8MB serialized history. Oversized histories return413, never silent truncation.
  Resync preserves previously retrieved rows; conditional updates reject races.
- `AuditHistory` is the durable manifest; `AuditMatch` links to shared match jobs.
  Interrupted materialization is repaired before a subsequent background cycle.
  Invalid lookup IDs remain visible as unavailable, without upstream requests.
- Change-point context goes first, then older remaining history. A cycle selects
  at most100 details and starts work for at most40s (plus in-flight completion).
  This is incremental, not thousands of synchronous requests on profile render.
- Per-match120s token leases serialize fills; stale owners cannot overwrite a
  reclaimed lease. Crashes can still cause a later retry after lease expiry;
  this is not an exactly-once distributed HTTP guarantee.
- Network/5xx jobs retry with exponential30/60/120/240/480s backoff, max5 attempts.
  Permanent400/403/404/410 failures become unavailable; quota deferrals do not
  consume attempts. Small rolling-window boundary delays retry the same batch.
- Worker cron becomes `* * * * *`; audit uses `/api/cron/audit`. Both cron routes
  require `CRON_SECRET` outside development. Watch remains hourly at UTC minute0,
  before audit. No notification route was invoked during verification.

## Report Semantics

- Audit scans every boundary of the retrieved, valid Competitive timeline with
  20 matches on each side. Non-Competitive, duplicate, future and invalid rows
  cannot inflate the sample; excluded record-ID counts are displayed.
- At least80% known ranks per window, within-window tier span <=4 and mean-tier
  difference <=2 are needed. This rejects mixed rank environments with similar
  averages. Existing sample/shot-data gates remain.
- K/D0.4, ACS60, HS8pt thresholds: at least two changes to surface a candidate.
  Nearby candidates consolidate; max5 shown. Strongest local candidate supplies
  performance/server/agent evidence; otherwise chronological halves remain.
  Adjacent-act rank changes are still a separate whole-history index component.
- UTC activity and repeated party-partner overlap are context only, not points.
  Party overlap needs >=80% known parties on both sides and at least two repeating
  partners per side; missing/conflicting party metadata stays unavailable.
- Progress distinguishes not-started, pending, partial and complete; unknown
  counts show dashes, not fictitious zero coverage. Storage failure is explicit.
  ACT/date-range tables expose archived/pending/unavailable counts. Missing
  provider records are outside the denominator, not proof of inactivity.
- Scores remain provisional until enrichment completes. Full retrieved coverage
  still does not guarantee lifetime history, identify an owner or prove misconduct.
  Diagnosis retains its separate recent90-day / max25 / min10-roster scope.

## Review And Verification

- Manual review plus real-SQL integration tests; no independent-agent review.
  Reviewed lease ownership, quota races, manifest recovery, concurrent resync,
  priority, malformed cache admission, privacy refusals and client/server imports.
- Browser-only helpers moved to `henrik-shared.ts`; client bundles must not import
  the D1/credential-aware request path. Initial build caught this dependency edge.
- `npm run check`: lint, typecheck,140 tests and production Next build.
  `npm run build:worker`: OpenNext bundle. Logs are in ignored `.build-tmp/`.
- Final browser-bundle scan:18 JS files, zero configured credential literals
  and zero D1/native SQLite dependency markers. Transport/invalid-body tests
  also verify credential-bearing error messages cannot reach callers.
- Live read-only Meiy report pages: EN/JA at1920/390/360px, no body overflow or
  page errors; methodology keyboard interaction checked. Current retrieved sample
  was2,134 rows. Audit25 is a provisional descriptive change index, not suspicion.
- Pending/partial transitions and ACT coverage used intercepted UI fixtures;
  no real bulk-start POST was sent. Local guards returned403/413/400.
- SQL tests use fresh in-memory SQLite with the actual schema/query paths;
  upstream responses in runner tests are fixtures, not live ingestion.

## Rollout Gates / Open Questions

- Confirm provider rules and whether all four quotas are independent; use shared
  scope if not. Also confirm persistent public-roster retention/deletion policy.
- Apply `db/upgrade-2026-10-30.sql` before deploying code. LOCAL D1 and SQLite
  upgrades were applied; production was not touched.
- High-throughput backfill assumes Workers Paid CPU/D1 query allowances.
  Validate production CPU, D1 storage cost, cron duration and concurrency first.
- Add Cloudflare rate-limit/WAF rules to public starts/profile traffic; IP limits
  are still per-isolate. Public traffic can consume foreground capacity.
- No calibrated false-positive rates, ownership verification, full lifetime
  guarantee, automatic retry of terminal unavailable details, or exactly-once
  watch delivery is claimed. Short/transient changes and unavailable history can
  be missed. Existing Encounters sampling limits are not removed by this feature.
