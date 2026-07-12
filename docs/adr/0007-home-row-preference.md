# 0007 — Home-row preference: declared per-row data, major keys only

Status: accepted (implementation deferred) · Date: 2026-07-11

## Context

`cost()` only penalises a row *change* between two consecutive notes (`rowChange`); it has no
notion of a row being the "right" one for the tune as a whole. Two fingerings that are locally
equally cheap (same number of row changes) can come out tied even when one idiomatically lives
on the tune's home row and the other doesn't.

## Decision

Add a home-row preference, resolved as follows:

- **Home key is explicit per-row instrument data (`Row.homeKey`), never derived from a row's
  pitch content.** The layout author already knows a row's key when writing the button data,
  same as every button's pitches (Invariant 1); deriving it by scale-matching is fragile
  (row-top accidental buttons could mislead a naive matcher) and unnecessary.
- **`Row.homeKey` is optional.** Accidental half-rows carry no home key and so never receive the
  preference — the same treatment as any other non-matching row (prefer a main row when one
  covers the note; fall back to the accidental row only when nothing else does, unchanged from
  today).
- **Minor and modal keys get no row preference at all.** The working assumption was "minor →
  relative major's row" (`Emin` → G); this is **disproven, not just deferred**. Bear Dance
  (`K:Em`) is played on the D row, not the relative major's G row, despite being fully playable
  on either row from pitch content alone (its sounding pitch classes `{A, B, D, E, F#, G}` contain
  neither C nor C#, the one note D and G major don't share). Row choice for minor/modal tunes is
  a real idiomatic/ergonomic call with no reliable static signal, so `offHomeRow` fires only when
  a tune's key is unambiguously major; minor/modal keys pass no target pitch class and today's
  row-change-only behaviour is unchanged.
- **The cost function becomes tune-scoped, not just instrument-scoped.** `makeCostFn` is
  currently built once and reused across every tune in the textarea. Home-row preference depends
  on `tune.key`, which varies per tune, so `makeCostFn` must be (re)built once per tune
  (`makeCostFn(instrument, weights, homeKeyPitchClass)`), alongside where `mapTuneCandidates` is
  already called per tune.

## Consequences

- New `CostWeights.offHomeRow` term, applied per-candidate alongside `rowChange`; skipped
  entirely when no target pitch class is passed, so minor/modal-key tunes are cost-identical to
  today.
- `Row` gains an optional `homeKey`; `DG_STANDARD`'s two treble rows become `D`/`G`. No accidental
  row is modelled yet, so nothing regresses.
- `App.tsx`'s single shared `makeCostFn(DG_STANDARD)` call (built outside the per-tune loop)
  moves inside it.
- Not yet implemented. `offHomeRow`'s magnitude needs the same hand-tuning-against-fixtures pass
  as `airPenaltyRate`/`rowChange` before it ships (roadmap step 6); a row-usage-ratio fixture
  check (D-row vs G-row candidate count, before/after) is the intended sanity check, mirroring how
  the air/row-change terms were verified.
- Reusable to a third row (or any diatonic layout) for free — the mechanism doesn't care how many
  rows exist, only whether each declares a `homeKey`.
