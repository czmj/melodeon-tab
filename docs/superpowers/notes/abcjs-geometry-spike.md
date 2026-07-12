# abcjs geometry spike — findings (Task 1)

Rendered Moon & Seven Stars via `renderAbc(target, abc, { add_classes: true })` and logged, per
note, `startChar`, `abselem.notePositions[0]`, and `abselem.elemset[0].getBoundingClientRect()`
relative to the container.

## Findings

- **Notehead x** is reliable from both `notePositions[0].x` and the SVG element's
  `getBoundingClientRect().left`; the two differ by ~5px (half a notehead). Use the bounding
  box: `rect.left - containerLeft + rect.width / 2` (screen pixels, robust to any viewBox
  scaling).
- **y is pitch-dependent.** `rect.top` / `notePositions.y` are the notehead top and move up/down
  with pitch — so a single note's y is NOT a usable per-row line.
- **Row breaks show as an x reset.** Notes are in reading order; x increases across a staff
  system and then drops back to the left at the next system (e.g. …727 → 77). This is an
  unambiguous row-break signal (x always increases within a system).
- Per staff row, the tab line = the **minimum note-top** among that row's notes (above the
  highest note). `.abcjs-staff path` also gives 5 staff-line y's per system, but deriving the
  row top from the notes needs no extra query and is self-consistent with the note coordinates.

## Decision

- `renderStaffNotation(target, abc, width): StaffAnchor[]` returns `{ startChar, x: notehead
  centre, y: notehead top }` per note (raw). No per-system computation in the parse layer.
- `placeTokens` (pure, unit-tested) groups anchors into rows by x-reset, takes each row's minimum
  y, and positions each token at `(x, rowMinY - offsetY)`, skipping rests and unmatched anchors.
