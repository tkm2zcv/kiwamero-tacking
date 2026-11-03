# Persistent-K/D audit revision

## Intent

Detect a sustained discontinuity in an account's observed performance, not an
identity or ownership change. Stored Competitive self-history is sufficient;
no new upstream reads, schema changes or automatic enrichment.

## Rules

- At least40 valid matches. Scan adjacent20-match windows, each split10/10.
- Valid integer owner ranks in >=80% of each window, range<=4 tiers.
- Declines allow lower owner ranks; >2-tier increases are not comparable.
  Improvements need a mean-rank gap<=2. Owner rank is not opponent strength.
- Aggregate K/D delta>=0.4. At least14 matches on each side must differ from
  the other aggregate by>=0.2 in the same direction. Both following halves
  differ from the preceding aggregate by>=0.3.
- Delta must exceed2.5 times the largest within-period half-window drift,
  with a drift floor0.05. A few outliers and linear ramps cannot substitute
  for broad, stable prior and following evidence.
- Prior K/D>=0.9, following<=0.8 and both following halves<=0.85:
  persistent-low-K/D contribution55. Other sustained K/D changes25.
- Persistent low K/D plus observed mean-owner-rank drop>=3/6 tiers adds10/20.
  An unsupported historical Act peak adds nothing.
- Different servers dominating>=80% of each window add10 alone,20 at the
  performance boundary. Country selection is metadata only, never migration.
- Concurrent UTC four-hour-bin total-variation distance>=0.6 adds5.
- Known primary-role change subtracts10 combat points. Any adjacent record gap
  >=30 days within the comparison window halves each contribution, rounded.
  Looking across the full window prevents boundary shifts evading the penalty.
- Consolidate nearby candidates, retain up to5, select one maximum-total event;
  never combine scores from different boundaries. Cap100; S70/A45/B25/C<25.
- Without eligible K/D windows: score/grade null, not a normal C.
- ACS/HS are descriptive only; missing shot data does not veto measured K/D.

## Verification

- Added16 regression tests, including Immortal-to-Gold low K/D, unchanged
  ACS/HS, missing shots, always-low K/D, strong current K/D, sparse/rankless
  samples, few extreme games, ten-game recovery, gradual trends, server timing,
  middle-history migration, shard aliases, role changes and recording gaps.
- Full286 tests pass; lint/typecheck and native workerd pass.
- Smurf-verdict hashes captured before this change remain identical.
- Next/OpenNext production build, Worker compatibility check and bundle scrub pass.
- Browser visual inspection and real-world accuracy calibration: not performed.

## Status And Limits

- User approved push/deploy. Source `ca817d6` is deployed as Worker
  `a1c8a3da-ad13-4c41-b9d5-f4206c437a99`.
- Deploy wrapper reran native workerd, Next/OpenNext, compatibility and scrub.
  Upload12374.52KiB, gzip3313.67KiB, startup17ms.
- Production root/login HTTP200; served BUILD_ID matches the local artifact.
  Authenticated profile rendering was not verified.
- No manual watch cycle, notifications, history-enrichment job or DB migration.
- K/D thresholds and point weights are explicit uncalibrated policy, not
  probabilities, confidence levels or measured detection accuracy.
- Map, opponent and party effects remain unverified. Recording gaps cannot
  distinguish inactivity from missing data; server choice is not physical country.

## Unresolved

- Calibrate false-positive rates with labeled longitudinal histories.
