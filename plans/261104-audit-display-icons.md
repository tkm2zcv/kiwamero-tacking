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
