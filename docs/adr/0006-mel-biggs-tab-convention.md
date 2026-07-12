# 0006 — Adopt Mel Biggs tab convention for TabCell

Status: accepted · Date: 2026-07-11

## Context

docs/melodeon-domain.md lists Rennie tab, Mel Biggs method, and Mally's (Dave Mallinson) as
target tab styles, with conventions to be "checked against real published examples before
building each renderer" (roadmap step 6).

A real published Mel Biggs sheet for "Christmas In Killarney" (© Mel Biggs Music — purchased
sheet music, not checked into the repo) gives the actual convention, per its printed key:

- A bare button number = inside row (D, home row); a number **in parentheses** = outside row
  (G row). E.g. `4 (5) (3) (3)`.
- **Underline = pull**; no underline = push.
- CAPS = bass button, lowercase = chord button, for tunes with a written bass/chord line
  (post-MVP — see docs/melodeon-domain.md bass end section).
- Chord symbols (D, G, Bm, A, E…) print above the staff as accompaniment hints, separate from
  the button-number tab line — consistent with how melodeon-domain.md already says MVP treats
  chord symbols.

## Decision

Adopt the Mel Biggs convention for `TabCell` (`src/render/tab.ts`) and its `StaffTab` view:

- `TabCell.text` carries the row encoding directly: bare `"3"` for inside/D row, `"(3)"` for
  outside/G row.
- `TabCell.pull: boolean` is the single direction cue; the view underlines the token when `pull`
  is true.
- `candidateLabel` (the spelled-out dropdown option text) is unaffected by any of this — it
  already spells out row and direction in words, so it was never ambiguous.

## Consequences

- Rennie and Mally's conventions remain unverified — this ADR only settles Biggs. **A choice of
  tab styles is planned post-MVP**: once the other conventions are checked against real published
  examples, add a style picker rather than committing further to Biggs as the only option.
- **Third-row support is unknown.** The verified example is a standard 2-row D/G box; it says
  nothing about how a third row would be notated (e.g. an ADG box, or a D/G box with an
  accidental row). Extending this convention to three-row instruments — a third bracket style,
  a different marker, or something else entirely — is unresolved and needs its own real published
  example before it's built, not assumed from the 2-row case.
- Bass/chord (CAPS/lowercase) button notation is documented here for when the bass end is built
  (post-MVP) but is not implemented — the shipped MVP is melody-only (docs/melodeon-domain.md).
