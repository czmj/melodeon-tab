# 0001 — Use abcjs for parsing, confined behind an adapter

Status: accepted · Date: 2026-07-01

## Context

ABC is the native notation of the target repertoire, so it is the input format. Writing an ABC parser is a large, well-trodden problem (repeats, ties, grace notes, key signatures applying accidentals) and the riskiest technical unknown in the project.

## Decision

Use abcjs and consume its parsed structure. Confine it entirely to src/parse behind an adapter that emits our own note-sequence types. No other module imports abcjs.

## Consequences

- Parsing risk is bought down; we consume a fraction of abcjs's output.
- Engine and renderers are testable with hand-written fixtures, no abcjs involvement.
- abcjs could later render staff notation alongside tab, or be swapped, without touching downstream code.
- Adapter must resolve the repeats question (unroll vs tab-as-written) — spike decides.
