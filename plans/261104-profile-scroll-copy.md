# Profile Copy and Scroll Controls

- User: Japanese encounter explanation; remove puzzling Performance/Best Matches
  scrolling without losing statistics or ACT selection.
- Reproduced on actual cards/CSS at1440px: both filter wrappers accepted
  scrollTop=20 because overflow-x:auto implied overflow-y:auto around negative
  spacing. The empty scroll region was not the match list.
- Replace scroll-strip/negative-spacing utilities with a normal flex toolbar.
  Keep dropdown overflow visible; constrain horizontal scrolling to the
  performance table, not the whole card.
- Centralize readable JA/EN coverage copy, keeping current recent50 scope,
  partial/unavailable data, blocked work and archive errors distinct.
- Add four copy regressions and an offline browser probe on real components/
  compiled CSS at1440/1024/375px, including dropdown hit testing and Escape.
- No live APIs, DB migrations, commits, push or deployment in this revision.
- Verification:317 tests, lint/typecheck, Next/OpenNext Worker compatibility and
  bundle scrub pass. Browser probe also passes against freshly compiled CSS at
  all three viewport widths. ACT popup hit testing and Escape dismissal pass.
- Self-reviewed localized copy, error states, overflow scoping and menu clipping.
  Browser data/images are offline fixtures, not an authenticated live profile.
