# Encounter history retrieval review

## Access And Scope

- Initial phase: user approved public documentation/static JavaScript reads only.
- Initial phase used no HenrikDev key or authenticated source-site session.
  A subsequent user-approved live probe is recorded below. Neither phase made
  notifications, application changes, direct production DB writes or deployments.
- Inspected the source site's current public `tracker-tabs-7wIaPKwC.js` and
  related route/client chunks. Protected `/tracker` returns307 to login.

## Confirmed Local Limitations

- `henrikdev.ts:getMatches` uses v3, without paging.
- `page.tsx:EncounterSection` narrows All to the latest two Acts.
- `ENCOUNTER_DETAIL_CAP=150` caps archive reads as well as queue admission.
  Selection excludes recent IDs but not already archived IDs. Once the first
  150 are archived, later renders select those same150 and queue nothing older.
- Local reproduction using the actual `selectUncoveredMatchIds`:300 rows,
  first150 archived, next render150 selected, zero queued,150 never reached.
  This is an application-side issue, not a key entitlement restriction.

## Public API Evidence

- [Matchlist](https://docs.henrikdev.xyz/valorant/api-reference/matchlist):
  v4 PUUID history supports `size` and `start`; default size10.
- [v4.1.0](https://docs.henrikdev.xyz/valorant/changes/v4.1.0):
  v4 filters the stored database before selecting requested matches, instead
  of filtering only a recent slice. This is a credible bulk-history path.
- [v4 schema](https://docs.henrikdev.xyz/api-reference/valorant/get-matches-by-puuid-v4):
  response includes full players/teams; schema differs from the current v3
  adapter (`match_id`, `started_at`, agent/tier objects and team arrays).
- [Stored history](https://docs.henrikdev.xyz/valorant/guides/stored-matches):
  stored-matches returns self stats, not full rosters. Omitted size means all
  currently stored matching records, not every match ever played.
- [Rate accounting](https://docs.henrikdev.xyz/general/rate-limiting):
  cost is API calls plus background Riot requests. Fully cached/stored history
  can cost1 per list request; cache misses add Riot history/detail costs.
  Do not equate request count with actual quota consumption.

## Source-Site Observations

- Client accepts server-precomputed `initialTeammates.all`, `.byAct`,
  `.fullMatchesCountByAct`, and available Acts.
- Its visible teammate aggregation uses PUUID, same team and same party ID.
- It explicitly includes an unavailable-detail notice for older seasons.
- Public JavaScript does not expose the server's HenrikDev retrieval/caching
  implementation or prove full roster coverage for every stored record.
  UI text "All matches loaded" alone is not completeness evidence.

## Recommended Change

1. Read every archived match in the requested scope, independently of fetch caps.
2. Remove the latest-two-Act restriction from All.
3. Add a v4 adapter and bounded background history-page cursor. Archive pages,
   dedupe match IDs and advance past covered matches; retain unfinished state.
4. Reuse immutable details across players; use per-ID fetches only for gaps.
5. Report covered/expected/unavailable records and honor actual quota headers.

If the API serves10 full matches per page,64 matches need7 list requests before
cache reuse, rather than64 per-ID requests. This is conditional arithmetic,
not a verified request/credit guarantee.

## Subsequent Approved Live Probe: ashrielle#4sh

- User subsequently requested a trial with this player. Announced and honored a
  maximum of4 HTTP reads, one configured key, no retries or key rotation.
- Account lookup200: region ap. Stored-list200 without a mode filter:
  total703, returned703, 2026-06-17 through2026-11-03.
- Remaining quota after the first two calls was11. Paused until the reported
  rolling window reset, rather than exhausting the key.
- v4 name-route `size=10&start=0`:200,10 returned, all10 rosters have10 players.
  Dates2026-11-02 through2026-11-03; remaining28/30.
- Same route `size=10&start=693`:200,10 returned, all10 rosters have10 players.
  Dates2026-06-17 through2026-06-21; oldest timestamp matches the stored list.
  Remaining27/30; observed historical-page decrement1 for10 matches.
- Distinct first/last page IDs and dates demonstrate that the historical offset
  works; this is not a recent-page response silently ignoring start.
- Total4 HTTP calls, all200. No full703-match retrieval, middle-page coverage
  verification, maximum-size test, or persisted roster/statistics import.
- Aggregate evidence saved in ignored
  `kiwamero-tracking/.tmp/ashrielle-full-history-probe.json`.
  Key partition identifiers redacted; no configured secrets stored.

## Unresolved

- All middle pages, possible partial/null records and quota cost across a
  complete run remain unverified. The page-size cap is confirmed below.
- At10 per page,703 records require71 list pages if the dataset remains stable;
  cached quota observations do not guarantee that cost for every page.
- Historical owner records without retained rosters cannot fabricate encounters.

## Maximum-Size Follow-Up

- User subsequently requested the largest possible single response.
- Three further authorized reads requested `size=1000`, `100`, then`20` at
  start0. All200, all returned10 rosters, not the requested larger count.
- The1000 request body was3,450,601 bytes. A10-match v4 payload includes round/
  event data; it is materially larger than the archived roster-only payload.
- The latter two requests showed remaining19->18->17. Total live HTTP calls
  across both probe phases:7. No claim of total quota cost: the initial remaining
  value and concurrent usage are not controlled.
- This initially established observed behavior only. A subsequent direct
  OpenAPI review confirms the documented cap for all four v3/v4 list routes.
  Do not promise that omitting size or specifying1000 returns all history.

## Implementation (Local)

- Added validated v4-to-archive conversion, per-PUUID target manifests, leased
  page cursor, cooldown/error states and empty/repeated-page safeguards.
- All archived records in the selected scope are read; only missing data is
  queued. Bulk pages precede per-ID gap fills in the existing minute Cron.
- Three adapter tests and eight persistent-queue tests cover703 targets in71
  list calls, restart/caching, leases,429, null slots, repeated pages and GC.
- Live full703-roster import, production migration/deployment and authenticated
  browser verification have not been performed.
- Raw v4 pages bypass the generic isolate response cache: the measured3.45MB
  pages would accumulate hundreds of megabytes across a whole account. Only
  validated slim rosters persist in the shared archive.
- Final297/297 tests, lint/typecheck, native workerd PNG/watch regression,
  Next production build, OpenNext Worker compatibility and bundle scrub pass.
  Self-review covered scope, lease races, resume behavior and raw-page memory.
  No independent review was requested or performed.

## Direct OpenAPI Recheck

- User requested another documentation review before approving rollout.
  Public documentation only; zero additional authenticated game API calls.
- Read [production OpenAPI](https://api.henrikdev.xyz/openapi.json) and
  [beta OpenAPI](https://beta.api.henrikdev.xyz/openapi.json) directly rather
  than relying on the less-detailed Mintlify pages or search summaries.
- On both specifications all four name/PUUID v3/v4 match-list routes describe
  `size` as: "Positive integer result count; values above 10 are capped at 10."
  Thus the10-row probe results match a documented cap, not evidence that a
  larger request would work after bypassing the cache.
- The schema's large numeric `maximum` concerns accepted input, not returned
  batch length. Direct specs show default5, unlike the overview's default10;
  explicit `size=10` avoids that documentation inconsistency.
- Stored-match routes explicitly say "Omit for unlimited results", but the
  stored record schema contains meta/stats/teams, not full player rosters.
- Current documented match-list parameters are affinity/platform/name/tag/
  puuid/mode/queue/map/size/start as applicable. No roster-only field selector
  or bulk/batch/encounter endpoint appears in either complete path list.
- Historical first-party evidence is consistent:
  [v1.7.2 release](https://github.com/Henrik-3/unofficial-valorant-api/releases/tag/v1.7.2)
  introduced v3 size with maximum10 due to response timeouts. This historical
  note alone would not establish today's v4 limit; the direct spec does.
- For703 unarchived target matches via this list API, ideal full10-row pages
  require71 HTTP calls; gaps/retries can add more and provider quota is separate.
  Cross-player archive reuse can reduce subsequent retrievals, including to zero
  when all target rosters are already stored locally.
- Source-site server-side fetching/caching remains unseen; its full-history UI
  does not establish that it obtains all rosters in one provider request.
- No application edits, commit, migration, deploy or further live probe in this
  recheck. The previously implemented local queue remains undeployed.

## Revised Scope: ALL Playlist and Recent50

- User subsequently requested ALL in the encounter match-category selector and
  limited new roster acquisition to recent50, with four-key reuse/deduplication.
- This supersedes unbounded full-history acquisition, not cached-history reads.
  Sources are unfiltered on Encounters; newest50 targets span all modes, while
  displayed Act/playlist filters still limit the encounter table.
- Persistent target snapshots are bounded to50 and carry observation times so
  stale renders cannot rewind them. Old archived matches remain readable.
- Recheck archives before each page, skip saved/terminal positions and request
  contiguous missing runs only. Global bulk leases prevent overlapping Cron
  workers from fetching the same shared histories concurrently.
- Offline regressions: cold50 ->5 requests, warm revisit ->0, one-game delta ->
  one size1 request, shared histories ->5 total rather than10. Four keys rotate
  without printing real credentials. No new live game API calls in this revision.
- These call counts assume stable provider ordering and valid data. Offset
  shifts, gaps and retries can add calls; HTTP count still is not quota cost.
- Final305/305 tests, lint/typecheck, native workerd PNG/watch regression,
  Next production build, OpenNext Worker compatibility and bundle scrub pass.
  Self-review covered snapshot leases, global recent selection and shared-cache
  reuse. Authenticated browser and independent review remain unperformed.
  This revision is local only; no commit/push/migration/deployment performed.
