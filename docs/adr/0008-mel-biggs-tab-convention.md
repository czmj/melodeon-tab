# 0008 — Adopt Mel Biggs tab convention for TabCell

Status: accepted · Date: 2026-07-11

## Context

docs/melodeon-domain.md listed Rennie tab, Mel Biggs method, and Mally's (Dave Mallinson) as
target styles with conventions "unverified — check against real published examples before
building each renderer" (roadmap step 6). The renderer shipped with a placeholder scheme
(underline = G row, colour+arrow = direction) invented before any real example was checked.

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

This directly conflicts with the placeholder: underline meant row, not direction, and row had no
visual encoding of its own.

## Decision

Adopt the Mel Biggs convention for `TabCell` (`src/render/tab.ts`) and its `StaffTab` view:

- `TabCell.text` carries the row encoding directly: bare `"3"` for inside/D row, `"(3)"` for
  outside/G row.
- `TabCell.pull: boolean` replaces the old `underline: boolean`; the view underlines the token
  when `pull` is true.
- Colour (red push / blue pull) and the arrow character are dropped entirely — Biggs' print
  original has neither, and matching the convention faithfully (text + underline only) was
  preferred over keeping the invented screen-only cues.

Only the compact tab-token display changes. `candidateLabel` (the spelled-out dropdown option
text) is unaffected — it already spells out row and direction in words, so it was never
ambiguous.

## Consequences

- `TabCell.underline` is renamed to `pull`; `colour` and `arrow` are removed. Anything
  constructing a `TabCell` by hand (tests) needs the new shape and the parenthesised `text` for
  outside-row cells.
- Direction now has a single visual cue (underline). Colour was a redundant but
  colour-blind-friendly signal; losing it is an accepted trade-off for print fidelity.
- Rennie and Mally's conventions remain unverified — this ADR only settles Biggs. If a different
  style becomes the default later, this decision should be revisited or superseded.
- Bass/chord (CAPS/lowercase) button notation is documented here for when the bass end is built
  (post-MVP) but is not implemented — MVP is melody-only (ADR 0004).
