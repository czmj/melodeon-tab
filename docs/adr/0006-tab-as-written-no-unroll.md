# 0006 — Tab as written; do not unroll repeats

Status: accepted · Date: 2026-07-03

## Context

ABC tunes carry repeats (`|: :|`) and variant endings (`|1 … :|2 …`). abcjs exposes this
structure (`bar_left_repeat`/`bar_right_repeat`, `startEnding`/`endEnding`) and, via its audio
path, the fully played-out order (see docs/abcjs-spike-findings.md). The fingering engine is a
shortest-path DP over note-to-note transitions (ADR 0003), so the order it consumes matters:
played order makes the `:|`→`|:` jump-back and ending seams real edges, whereas written order
does not.

Three options: (A) unroll fully — DP and tab both in played order (doubled-out tab); (B) unroll
internally — DP in played order, tab folded back to concise repeat marks; (C) no unroll — DP in
written order, tab concise.

## Decision

Adopt **C** for MVP. Keep the tab concise: repeats and endings remain as marks, each written
note appears once with a single fingering, and the DP runs over written order. The parse adapter
emits notes in written order plus the bar/repeat structure the renderer needs; it does not
unroll.

The unmodelled transitions (repeat jump-back, ending seams) all fall on section/phrase
boundaries, where the cost model already treats bellows reversals as nearly free
(docs/melodeon-domain.md), so the approximation is second-order and within the domain's stated
tolerance for phrase-boundary approximation.

## Consequences

- Concise, readable tab — the primary aim at this stage.
- One fingering (and later, one chord accompaniment) per written note: no "different second time
  through". A player's PDF of alternate repeat chords exists and would seed a fixture when the
  bass end is built (post-MVP).
- The DP stays a single linear pass over written order — no structural special-casing in the
  search, consistent with ADR 0003.
- Upgrade path to B is engine-only: the tab output is identical, so feeding the DP played order
  and folding the result back needs no renderer change. Revisit only if section-boundary
  fingering looks wrong during cost tuning (roadmap step 6).
