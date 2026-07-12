# 0007 — Accompaniment model: independent bass/chord buttons, melody-first per strike

Status: accepted · Date: 2026-07-11

## Context

The bass end is the next priority (docs/roadmap.md). ADR 0002 already shaped the data model
for it: `Instrument.bass` exists, and `Button.push`/`pull` are pitch *arrays*, so a bass button
that sounds several pitches per direction needs no schema change. The melody engine already emits
a per-note `Candidate` carrying bellows direction — the coupling variable the bass layer consumes.

docs/melodeon-domain.md's bass-end section fixes the domain facts: ~8 buttons in bass/chord pairs,
bisonoric; on a D/G box D and C chords sound in both directions, G is push-only, A pull-only,
E (pull) and B (push) serve as thirdless minors; chord labels are **derived** from sounding
pitches, never looked up; cross-row hacks (A bass + C chord ≈ Am) then work for free.

Three refinements settle the model beyond that section:

- **Bass and chord buttons are chosen independently.** A "pair" is a physical adjacency, not an
  atomic unit — a player sounds the bass alone, the chord alone, or both (oom-pah). So each is its
  own `Button`, and the engine makes two separate choices per strike, not one.
- **The harmony target is piecewise-constant over note position, not bar-quantised.** ABC chord
  symbols attach at a `startChar` that can fall mid-bar; the target changes where the symbol
  changes.
- **Thirds present-or-not is per-button layout data.** A chord button holds either a full triad
  or a thirdless root+fifth dyad, depending on the physical box. A bare dyad is genuinely
  ambiguous (D vs Dm) and is resolved by the harmony context, not by the button.

## Decision

**Bass end is layout data, same discipline as the treble.** Populate `DG_STANDARD.bass.buttons`
with individual bass buttons (single-pitch push/pull) and chord buttons (multi-pitch push/pull),
from the *same verified source* as the treble — lesterbailey.org "D/G 21 with low notes", whose
chart includes the bass end. Transcribed (push│pull), the 8 buttons are:

| Button | Push | Pull |
|--------|------|------|
| chord (D+/A+ pair) | D major | A major |
| chord (B+/E- pair) | B major | E minor |
| bass  | D | A |
| bass  | B | E |
| chord (G+/D+ pair) | G major | D major |
| chord (C+/C+ pair) | C major | C major |
| bass  | G | D |
| bass  | C | C |

This cross-checks cleanly against the domain facts above (D and C majors both directions, G
push-only, A pull-only, E minor on pull). Two notes on turning it into pitch data:
- **This box has thirds.** The chart labels chords major/minor, a distinction that requires the
  third to be present — so `DG_STANDARD`'s chord buttons are full triads. The thirdless-dyad case
  the model must still support (below) is a *different box's* configuration, not this instance's.
- **The chart gives no bass octaves** (note name + quality + direction only). Chord derivation and
  target-matching operate on pitch *classes*, so conventional octaves are assigned and are safe for
  suggestion; flagged as an assumption to revisit if/when audio playback needs true registers.

**Chord derivation is a pure module** (`src/domain/chord.ts`): given a multiset of sounding pitch
classes, return candidate chord labels (root + quality), with a thirdless dyad returning both the
major and its parallel minor. And a scoring function: how well a button's sounding pitches match a
target chord. Labels are derived, never stored (ADR 0002).

**Chord symbols become the harmony target.** Parse abcjs's `item.chord` accompaniment hints (today
dropped entirely) into the `Tune` model with their `startChar`, forming a piecewise-constant target
over the tune. Where a tune carries no symbols, fall back to a crude per-bar root-triad guess from
the melody's pitches — a deliberate v1 stopgap, not real harmonic analysis. (Prior art for a better
fallback later: seisiuneer/abctools' `abc_backup_chord_solver.html` infers chord symbols for a
bare melody by matching phrases against a thesession.org chord database — a route to consider if
the crude guess proves inadequate. It is *not* a bass-hardware source.)

**Accompaniment is melody-first, per strike, bass and chord independent.** For each strike point,
given the direction the melody fingering already chose and the active harmony target:
- enumerate bass buttons playable *in that direction*, score their root against the target → best bass;
- enumerate chord buttons playable *in that direction*, score their pitch-set against the target
  (a thirdless dyad scores as compatible with both the major and its parallel minor) → best chord.
Where the wanted harmony is unavailable in the melody's direction (G-push chord wanted while the
melody is pulling), surface a **gap** — visible, never a crash — exactly as diatonic treble gaps
are surfaced today.

**Render** the chosen bass/chord line in the Mel Biggs convention already fixed by ADR 0006:
CAPS = bass button, lowercase = chord button. Renderer stays a pure view (Invariant 5).

## Consequences

- `candidatesForPitch`/`resolveCandidate` currently hardcode `.treble.buttons`; the bass path
  needs them parameterised by keyboard (or bass-specific variants). Small, mechanical.
- The engine gains `src/engine/accompaniment.ts` producing per-strike bass/chord suggestions from
  a `FingeringResult` + harmony targets + bass keyboard. It reads the melody's direction; it does
  not change it.
- **Explicitly deferred:** joint optimisation (bass demand feeding *back* into melody fingering —
  docs/melodeon-domain.md's "honest model", where G-push/A-pull would bind the melody); manual
  bass overrides (a fast-follow mirroring the treble's pin-and-recompute, Invariant 4); 12-button
  bass; real harmonic analysis for the no-symbols fallback; and any oom-pah *rhythm* model — the
  engine answers "best bass and best chord for this span and direction", not which beats get which.
