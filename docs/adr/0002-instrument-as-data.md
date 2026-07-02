# 0002 — Instrument layouts are data with uniform push/pull pitch maps

Status: accepted · Date: 2026-07-01

## Context

Melodeons are bisonoric: each button sounds different pitches per bellows direction. Layouts vary widely (D/G, G/C, accidental rows, reversals; bass ends differ per box and players customise). Bass buttons sound multiple pitches, and cross-row bass combinations produce chords not on any single button (e.g. A bass + C chord ≈ Am).

## Decision

An instrument is two keyboards (treble, bass), each a set of buttons, each button a {push: pitches[], pull: pitches[]} map. Treble buttons happen to have single-pitch lists; bass buttons multi-pitch. Chord names are derived by analysing simultaneous sounding pitches, never stored as labels. Concrete layouts (starting with D/G treble) are instances of this schema. No button/pitch knowledge is hardcoded outside instances.

## Consequences

- Feasibility, fingering, chord derivation and rendering all work off one schema without knowing which end is which.
- Cross-row bass hacks and thirds-removed chord ambiguity are handled for free.
- Layout presets and a future layout editor are pure data work.
- MVP ships exactly one instance (D/G treble); configurability is architecture, not a feature.
