# Account audit: persistent K/D discontinuities

## Scope

- Reframe the audit as change-point evidence, not identity verification.
- Keep stored Competitive self-history as the only required data source.
- No additional foreground APIs or schema migration. Subsequent user approval
  covered push/deploy: `ca817d6`, Worker `a1c8a3da-ad13-4c41-b9d5-f4206c437a99`.

## Contract

- Scan adjacent 20-match windows, with two 10-match halves on either side.
- A K/D change must exceed 0.4, persist across both following halves and at
  least 14 following matches, and exceed within-window drift by a factor >2.5.
- Stable recorded rank coverage >=80%, spread <=4 tiers per window. Declines
  may cross to lower recorded ranks; rises require comparable recorded ranks.
- Persistent low K/D: prior K/D >=0.9, following <=0.8, each following half
  <=0.85. Shot/ACS changes are not prerequisites.
- Score a single boundary, never sum unrelated periods. K/D cap55, observed
  rank-drop context cap20, server context cap20, simultaneous UTC-hours cap5.
- Server shift alone adds10, simultaneous with K/D adds20. Require a local
  dominant-server switch, not a lifetime endpoint difference. Country selection
  is informational and cannot change the score.
- A role change reduces the K/D contribution by10. A >=30-day gap halves the
  boundary's contributions and is explicitly disclosed.
- No eligible K/D windows means evaluation withheld, not grade C. All numerical
  thresholds are declared heuristic policy, not empirically calibrated accuracy.

## Work

- [x] Add regression scenarios for gradual change, historical Immortal/current
  Gold with sustained low K/D, low historical K/D, strong current K/D, recovery,
  missing shots/ranks, zero deaths, unsupported peaks, server timing and gaps.
- [x] Update timeline, score contract and visible explanations.
- [x] Preserve smurf diagnosis output and optional enrichment behavior.
- [x] Run regression suite, lint, typecheck, native workerd and builds/scrub.
- [x] Document limitations, local verification and approved production deployment.

## Unresolved

- Real-world false-positive rate requires labeled longitudinal histories.
- Stored owner ranks are not actual opponent ranks or physical countries.
