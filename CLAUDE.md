# melodeon-tab

Web app converting ABC notation into melodeon tablature, with automatic fingering suggestion and per-note manual overrides.

## Commands

- `npm run dev` — Vite dev server
- `npm test` — Vitest
- `npm run build` — production build

## Domain essentials

A melodeon is a **bisonoric, diatonic** button accordion. These facts constrain all code; violating them produces plausible-looking but wrong output:

- Every button sounds a **different pitch on push vs pull** (bellows direction).
- A written pitch therefore maps to **multiple candidates** — (button, row, direction) triples — sometimes one, sometimes none (diatonic gaps are normal, not errors; they must be surfaced, never crash).
- Rows are tuned a fourth apart, so pitches overlap between rows, often in opposite directions ("reversals"). Choosing between in-row and cross-row candidates is the core of fingering.
- There is **one bellows**: all simultaneously sounding notes, both hands, must share one direction.
- Bass buttons sound multiple pitches per direction. Chord names are *derived* by analysing sounding pitches, never looked up.

Full domain reference: @docs/melodeon-domain.md

## Invariants

1. Instrument layouts are **data** conforming to the schema in src/domain/instrument.ts — never hardcode button/pitch knowledge outside layout instances.
2. abcjs is confined to src/parse. Everything else consumes our own note-sequence types. Never import abcjs elsewhere.
3. The fingering engine is a shortest-path DP over a candidate lattice. All musical judgement lives in the pure function `cost(from, to, context)` — never as special-case rules in the search.
4. User overrides are hard constraints: pin the node, recompute the DP downstream. Never silently discard an override.
5. Tab styles are pure views over fingering results. Renderers hold no fingering logic.
6. Domain/engine code is plain TypeScript, UI-independent, unit-tested with fixtures in src/fixtures. React is shell only.

## Conventions

- TypeScript strict. No comments in produced code.
- British English in UI copy and docs.
- Minimal changes; don't refactor unrelated code.
- When unsure between approaches, present both and let me choose.

## Architecture decisions

ADRs live in docs/adr/. **Read relevant ADRs before proposing architectural changes.** If we make a new architectural decision, propose an ADR for it.

## Current status

MVP complete — post-MVP roadmap: @docs/roadmap.md
