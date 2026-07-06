# 0007 — Bellows air is carried as DP coupling state, read by the cost function

Status: accepted (implementation deferred) · Date: 2026-07-06

Extends ADR 0003 (fingering as shortest-path Dynamic Programming (DP) with a pluggable cost function).

## Context

Some fingering judgements are history-dependent. The clearest is bellows air management: a
long run in one direction risks running out of air (or bottoming out the bellows), so it should
be penalised and broken up — ideally by reversing on a strong beat.

ADR 0003 puts all judgement in a pairwise `cost(from, to, context)`. That signature cannot
express air on its own: it sees only two adjacent notes, not how long the current direction has
persisted, so no per-edge cost can tell the 2nd push in a run from the 12th. A flat
"stay-in-direction" cost does not help either — reversing then merely adds cost without making
subsequent notes cheaper, so the DP never chooses to break a run. Air is a property of the
*path*, not of an edge.

## Decision

The DP carries the bellows run as **coupling state**. A lattice node becomes
`(candidate, sameDirectionRun)` — the run length in the current bellows direction — reset at
breath points (rests and phrase boundaries). The run length is exposed to the cost function
through `CostContext`, so `cost()` still owns every musical judgement (ADR 0003 preserved); the
search only *tracks* the coupling variable. `cost()` adds a penalty that grows with the run, so
a long same-direction section eventually makes reversing the cheaper path; combined with
beat-weighted reversal cost, the break lands on a strong beat.

Sequencing: the pairwise, per-note context (beat strength, phrase boundary) is wired into
`cost()` **first**; the run-state augmentation follows once that is in place. Until then the
naive flat weights (reversal 1, row-change 0.5, context ignored) stand.

## Consequences

- Realises the domain doc's "honest model: bellows as coupling variable" while keeping ADR
  0003's "all judgement in `cost()`" intact — `cost()` reads the run from context; the search
  adds no musical special-cases.
- DP state grows by a small, bounded factor (run length is capped/quantised), so search stays
  cheap.
- `CostContext` gains a run-length field (and possibly a net-air field later); `cost()` and the
  DP change together, and the naive cost tests are re-baselined at that point.
- Reset semantics depend on breath-point detection (rests, phrase boundaries), which is
  approximate — acceptable per the domain doc's stated tolerance for phrase-boundary
  approximation.
- This is the seam where post-MVP bass-end direction coupling plugs in: one bellows, so a
  left-hand chord wanting a direction contributes to the same coupling state.
