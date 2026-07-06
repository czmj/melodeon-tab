# 0003 — Fingering suggestion is shortest-path DP with a pluggable cost function

Status: accepted · Date: 2026-07-01

## Context

Good fingering resists strict rules: bellows reversals are bad mid-phrase on weak beats but cheap or desirable on strong beats and phrase boundaries; cross-rowing vs in-row bounce is style, not correctness. Players optimise globally across a phrase, not greedily.

## Decision

Build a lattice (column per note, node per (button, row, direction) candidate) and find the cheapest path by DP (Viterbi). All musical judgement lives in a pure function cost(fromNode, toNode, context) where context carries beat strength and phrase-boundary info. Costs are context-dependent — notably reversal cost varies by metrical position. Strategy presets are weight vectors over the same cost terms.

## Consequences

- Global optimisation matches player behaviour; candidate sets are small so search is trivially cheap.
- Cross-row-for-smoothness and idiomatic bounce emerge from weights rather than special-case rules.
- The cost function is the single seam for presets, future bass-end direction coupling (a chord wanting a direction adds a term), and any learned weights.
- Weights are hand-tuned against fixture tunes fingered by a real player; no pretence of learned correctness in MVP.

Extended by ADR 0007: history-dependent judgement (bellows air) is handled by carrying the bellows run as DP coupling state and reading it in `cost()` via context — the search tracks the coupling variable, judgement stays in `cost()`.
