# 0004 — Overrides are hard constraints with downstream recomputation

Status: accepted · Date: 2026-07-01

## Context

No cost weighting matches every player's taste; contested notes are genuine taste calls. The product goal is to be confidently correctable rather than always right.

## Decision

A user override pins that note's lattice column to a single node and the Dynamic Programming (DP) recomputes everything downstream of it. Overrides are never silently discarded. Where best and second-best paths through a region are close in cost, mark those notes as low-confidence in the tab.

## Consequences

- One manual fix propagates sensibly; overrides feel powerful rather than fiddly.
- Low-confidence marks direct attention to exactly the taste-call notes and honestly represent uncertainty.
- Overrides must persist (localStorage now, DB later) alongside the tune.
- Logged overrides are potential future training data for per-user weight adjustment.
