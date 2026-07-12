# 0003 — Engine architecture: shortest-path DP with pluggable cost function and bellows-air coupling state

Status: accepted · Date: 2026-07-01 (extended 2026-07-06)

## Context

Good fingering resists strict rules: bellows reversals are bad mid-phrase on weak beats but
cheap or desirable on strong beats and phrase boundaries; cross-rowing vs in-row bounce is
style, not correctness. Players optimise globally across a phrase, not greedily.

Some fingering judgements are also history-dependent. The clearest is bellows air management: a
long run in one direction risks running out of air (or bottoming out the bellows), so it should
be penalised and broken up — ideally by reversing on a strong beat. A pairwise
`cost(from, to, context)` cannot express this on its own: it sees only two adjacent notes, not
how long the current direction has persisted, so no per-edge cost can tell the 2nd push in a run
from the 12th. A flat "stay-in-direction" cost doesn't help either — reversing then merely adds
cost without making subsequent notes cheaper, so the DP never chooses to break a run. Air is a
property of the *path*, not of an edge.

## Decision

Build a lattice (column per note, node per (button, row, direction) candidate) and find the
cheapest path by Dynamic Programming (DP, the Viterbi algorithm). All musical judgement lives in
a pure function `cost(fromNode, toNode, context)` where context carries beat strength and
phrase-boundary info. Costs are context-dependent — notably reversal cost varies by metrical
position. Strategy presets are weight vectors over the same cost terms.

To handle history-dependent judgement without breaking that signature, the DP carries the
bellows run as **coupling state**. A lattice node becomes `(candidate, sameDirectionRun)` — the
run length in the current bellows direction — reset at breath points (rests and phrase
boundaries). The run length is exposed to `cost()` through `CostContext`, so `cost()` still owns
every musical judgement; the search only *tracks* the coupling variable. `cost()` adds a penalty
that grows with the run, so a long same-direction section eventually makes reversing the cheaper
path; combined with beat-weighted reversal cost, the break lands on a strong beat.

## Consequences

- Global optimisation matches player behaviour; candidate sets are small so search is trivially
  cheap.
- Cross-row-for-smoothness and idiomatic bounce emerge from weights rather than special-case
  rules.
- The cost function is the single seam for presets, future bass-end direction coupling (a chord
  wanting a direction adds a term to the same coupling state), and any learned weights.
- Weights are hand-tuned against fixture tunes fingered by a real player; no pretence of learned
  correctness in MVP.
- DP state grows by a small, bounded factor (run length is capped/quantised), so search stays
  cheap.
- `CostContext` gains a run-length field (and possibly a net-air field later); `cost()` and the
  DP change together, and cost tests are re-baselined at that point.
- Reset semantics depend on breath-point detection (rests, phrase boundaries), which is
  approximate — acceptable per the domain doc's stated tolerance for phrase-boundary
  approximation.
