# Audit Display Icons

- Add image flags next to server names in audit server composition and ACT history.
- Add the matching24px rank badge beside each known ACT peak rank.
- Reuse the existing match-history country mapping and tierIcon asset helper.
- Share server labels with match-history chips; keep unknown servers as text and
  unranked ACTs without a misleading badge. Do not alter assessment/data fetching.
- Check actual JA/EN audit components at1440/1024/375px, icon URLs/dimensions,
  unknown/unranked fallbacks, counts/percentages and existing filter behavior.
- Preserve the separate, pending external-navigation fix. Local changes only.

## Results

- Shared server labels used in audit composition/transitions/ACTs and match chips.
- Bronze3 uses tier8 and Immortal1 uses tier24 assets; unknown/unranked rows
  retain text without an invented badge. Existing counts and percentages retained.
- Fresh342 tests, lint/types, native D1/PNG, Worker build/scrub, offline browser
  budget/external-navigation checks and JA/EN1440/1024/375px layout checks pass.
- No game API calls or production changes. User approved commit/push of both
  fixes only; production deployment requires separate approval.

## Subsequent Approved Deployment

- User approved deployment of both fixes; code97465b6 includes7a613e0.
- Worker `fbf6077b-db34-42fb-a5a3-daaae64eed22` active100%, BUILD_ID
  `qjqeMZTdUN98Tz752z8Mr`; released2026-11-04T05:07:13.584676Z.
- Fresh342 tests/all gates pass; deployed CSS and representative4 image URL
  HEAD200/image/png responses verified. Authenticated production UI not exercised.
- No migrations or manual game/DB/cron/notification operations.
