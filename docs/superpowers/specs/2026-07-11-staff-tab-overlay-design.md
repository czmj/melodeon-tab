# Staff-aligned tab overlay — design

Render each note's melodeon tab token (button number + push/pull arrow + colour + G-row
underline) **above the corresponding note in the staff notation**, replacing the separate
text-tab row. Stay on abcjs.

## Goal

The tab currently renders as a standalone row of styled spans, disconnected from the staff.
Position each token directly above its note so the reading maps 1:1 to the notation, keeping the
existing styling, the low-confidence highlight, and the click-to-override interaction.

## Scope

In:
- A DOM overlay of styled, clickable tab tokens positioned above the matching staff notes.
- Replace the per-tune text-tab row with this staff overlay; **keep the debug table**.
- Responsive: the staff reflows to the container width and the overlay repositions.

Out (unchanged / later): the fingering engine, cost weights, the debug table's contents, any
change to tab-token styling, verifying a published tab style (still roadmap step 6).

## Decisions

1. **Stay on abcjs; overlay driven by abcjs geometry.** abcjs exposes each note's rendered
   position (`AbsoluteElement.notePositions`, `elemset`) and its source `startChar`, so we can
   place custom styled/clickable content above any note. Rejected alternatives: abcjs text
   annotations (`"^token"` — no colour/underline/click), abcjs's `tablature` plugin
   (guitar/violin only), and switching notation library (abcjs already does our parsing and
   gives positions — a switch is a large rewrite for no gain).
2. **Join by `startChar`.** Our `NoteEvent.startChar` (already the override-identity key, unique
   per note across the whole ABC) is the join key between the fingering and the rendered notes.
3. **Responsive by re-render, not viewBox scaling.** Render abcjs at the container's pixel width
   (`staffwidth`), so note coordinates are 1:1 pixels; a `ResizeObserver` re-renders + recomputes
   anchors on width change. (Replaces today's `responsive: 'resize'`.)
4. **Replace the text-tab row; keep the debug table.**
5. **Rests are omitted above the staff** (nothing to finger); **unplayable notes show `?`**.

## Architecture

One abcjs render covers the **whole ABC** (all tunes in the textarea). The overlay therefore
aggregates every tune's fingering, keyed by `startChar`, and positions tokens over the single
combined staff. Interaction (selection + override) moves to the top level, keyed by `startChar`.

### `src/parse/renderStaff.ts` — render + anchors (abcjs confined here, Invariant 2)

```ts
export interface StaffAnchor {
  startChar: number
  x: number // px, left edge of the notehead within the container
  y: number // px, a line just above the note's staff system
}

// Renders the staff into `target` at pixel width `width`; returns one anchor per rendered note.
export function renderStaffNotation(target: HTMLElement, abc: string, width: number): StaffAnchor[]
```

Renders with `{ staffwidth: width, add_classes: true }`, then walks the returned visual object;
each note voice element carries `startChar` and an `abselem` with rendered geometry. `x` comes
from the notehead position (`abselem.notePositions[0].x`); `y` is a fixed offset above the top of
that note's staff system (so tokens sit on a consistent line per system, not bouncing with
pitch). If geometry is unavailable for a note it is skipped. The `StaffAnchor` type is ours, so
the overlay imports no abcjs.

### Fingering aggregation (top level)

Build `Map<number, NoteFingering>` keyed by `startChar` across all parsed tunes:

```ts
interface NoteFingering {
  note: NoteEvent
  cell: TabCell        // from renderTab — the styled token content
  options: Candidate[] // lattice[i], for the override panel
  chosen: Candidate | null
}
```

Each tune's fingering is computed as today (`fingerWithConfidence` with its `startChar`-keyed
pins); the results are merged into one map. `startChar` is globally unique, so no cross-tune
collision.

### `StaffTab` component (view)

A positioned wrapper: the abcjs SVG (rendered into a ref'd child) plus an absolutely-positioned
overlay layer. On mount / `abc` change / resize it calls `renderStaffNotation` and stores the
returned anchors in state. For each anchor it looks up `NoteFingering` by `startChar`; if found
and not a rest, it renders the styled token (reusing the `TabCell` fields — number, ↑/↓, colour,
underline, low-confidence highlight, pinned bold) absolutely positioned at `(x, y)`. Clicking a
token calls `onSelect(startChar)`.

Responsive: a `ResizeObserver` on the wrapper (debounced) re-invokes the render at the new width
and refreshes anchors.

### Selection + override (in `App`)

`App` builds the aggregated `startChar → NoteFingering` map, owns `selectedStartChar: number |
null`, and renders `StaffTab` (passing the map, anchors source, and an `onSelect(startChar)`
callback) plus the `OverridePanel`. The panel reads the selected note's `NoteFingering` (note,
options, chosen) from the map and pins/clears by `startChar` (the pin plumbing already works this
way). `pins` state and persistence stay in `App` as now.

### `TuneView` reduced

`TuneView` loses the text-tab, its fingering memo, selection state, and the override panel — it
becomes the tune header + the debug table only. The interactive tab now lives once, over the
combined staff.

## Data flow

`NoteEvent.startChar` → `StaffAnchor.startChar` (from the render) and → `NoteFingering.startChar`
(from the aggregation). The overlay joins the two by `startChar`; the override panel and pins use
the same key.

## Edge cases

- **Ties:** we merge tied notes into one `NoteEvent` (first note's `startChar`); abcjs draws both
  noteheads. The second notehead's `startChar` has no `NoteFingering`, so it gets no token —
  correct (one held note, one fingering).
- **Grace notes, repeat bars:** no matching `NoteFingering` → skipped.
- **Rests:** omitted above the staff.
- **Unplayable notes:** token shows `?`.
- **Parse error / empty:** no staff, no anchors, no overlay (existing error path).
- **Chord `[GBd]`:** one flattened `NoteEvent` / one notehead group → one token.

## Testing

- Pure, unit-tested: aggregating tunes into the `startChar → NoteFingering` map, and joining an
  `anchors` array to that map to produce positioned tokens (given synthetic anchors), including
  the tie/grace/rest skip rules.
- Browser-verified (as `renderStaff` already is): the abcjs geometry extraction and pixel
  positioning across an initial render and a resize. A short spike confirms
  `abselem.notePositions` gives usable coordinates before the overlay is built.

## Risks

The one real unknown is the geometry extraction — reading reliable per-note x/y from abcjs's
render and keeping it aligned across reflow. Mitigation: validate it first with a small spike
(render a fixture, log `notePositions` / `elemset` bounding boxes) before building the overlay;
fall back to measuring `elemset[0].getBoundingClientRect()` relative to the wrapper if
`notePositions` proves insufficient.

## Invariants

- abcjs stays in `src/parse` (`renderStaff` returns the `StaffAnchor` type; the overlay imports
  no abcjs) — Invariant 2.
- The overlay is a pure view over fingering results + anchors; no fingering logic — Invariant 5.
