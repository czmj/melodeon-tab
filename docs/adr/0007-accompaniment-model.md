# 0007 — Accompaniment model: independent bass/chord buttons, chord-first direction

Status: accepted · Date: 2026-07-11 (chord-first direction added 2026-07-12)

## Context

ADR 0002 already shaped the data model for the bass end: `Instrument.bass` exists, and
`Button.push`/`pull` are pitch *arrays*, so a bass button that sounds several pitches per direction
needs no schema change. The melody engine already emits a per-note `Candidate` carrying bellows
direction — the coupling variable the bass layer consumes.

docs/melodeon-domain.md's bass-end section fixes the domain facts: ~8 buttons in bass/chord pairs,
bisonoric; on a D/G box D and C chords sound in both directions, G is push-only, A pull-only,
E (pull) and B (push) serve as thirdless minors; chord labels are **derived** from sounding
pitches, never looked up; cross-row hacks (A bass + C chord ≈ Am) then work for free.

Four refinements settle the model beyond that section:

- **Bass and chord buttons are chosen independently.** A "pair" is a physical adjacency, not an
  atomic unit — a player sounds the bass alone, the chord alone, or both (oom-pah). So each is its
  own `Button`, and the engine makes two separate choices per strike, not one.
- **The harmony target is piecewise-constant over note position, not bar-quantised.** ABC chord
  symbols attach at a `startChar` that can fall mid-bar; the target changes where the symbol
  changes.
- **Thirds present-or-not is per-button layout data.** A chord button holds either a full triad
  or a thirdless root+fifth dyad, depending on the physical box. A bare dyad is genuinely
  ambiguous (D vs Dm) and is resolved by the harmony context, not by the button.
- **The chord drives the bellows direction, not the other way round.** A first cut fingered the
  melody with no knowledge of the chords, then derived the accompaniment from whatever direction
  the melody happened to pick. That inverts how a player thinks and it breaks concretely: on Òran
  na Cloiche's opening `"Am"` bar, Am is only realisable as an **A bass + C chord** and the A bass
  is **pull-only**, but the melody fingered one note on the push and the Am collapsed to a C bass.
  The chord should have held the whole run on the pull.

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
major and its parallel minor. And a scoring function (`matchScore`): how well a button's sounding
pitches match a target chord — root/third/fifth present, clashing third and foreign notes
penalised, so a genuine relative-major substitute (C for Am) beats a chord that merely shares the
root by coincidence (D for Am). Labels are derived, never stored (ADR 0002).

**Chord symbols become the harmony target.** Parse abcjs's `item.chord` accompaniment hints (once
dropped entirely) onto the note they precede (`NoteEvent.chordSymbol`), validated through
`parseChordSymbol` so text annotations are not mistaken for chords, forming a piecewise-constant
target over the tune. Where a tune carries no symbols, fall back to a crude per-bar best-fit box
chord from the melody's pitches — a deliberate v1 stopgap, not real harmonic analysis. (Prior art
for a better fallback later: seisiuneer/abctools' `abc_backup_chord_solver.html` infers chord
symbols for a bare melody by matching phrases against a thesession.org chord database. It is *not* a
bass-hardware source.)

**Direction is a per-span, chord-first decision** (`src/engine/harmony.ts`). Harmony analysis runs
*before* melody fingering (it never needed the bellows direction — the target comes from the symbol
or the bar's notes):

- Per note: a target chord and its **source** (`written` | `fallback`), piecewise-constant.
- Per target: a **preferred direction** — score how well the box realises the target chord *and*
  its root bass in each direction (`matchScore` of the best chord plus the best bass button); the
  higher-scoring direction wins, a tie means *no preference*. Bidirectional chords (D, C) tie and
  impose nothing; direction-locked ones (G→push, A→pull, Am→pull via its pull-only A bass) get a
  clear preference.

That preferred direction feeds two places:

- **Melody fingering** gains a cost term (Invariant 3 — judgement lives in `cost()`): a candidate
  whose direction disagrees with its note's preferred direction is penalised, by an amount keyed to
  the harmony source — **strong for `written`, weak for `fallback`** (a future `pinned` chord tier
  is strongest). Pinned *melody* notes remain hard DP constraints and so still win — "the melody
  follows the chord unless pinned." Threaded in as an optional `computeFingering` argument that
  defaults to absent, so the bias only applies once a caller passes harmony.
- **Accompaniment** (`src/engine/accompaniment.ts`) chooses bass and chord independently — best
  bass button and best chord button in the note's direction — but sounds them only where the note's
  direction matches the span's preferred direction. On an off-direction note it **rests** rather
  than sounding a wrong voicing; spans with no preference sound on every note.

**Render** the chosen bass/chord line in the Mel Biggs convention already fixed by ADR 0006:
CAPS = bass button, lowercase = chord button. Renderer stays a pure view (Invariant 5).

## Consequences

- `resolveCandidate` is parameterised across both keyboards so bass candidates resolve; melody
  candidate mapping stays treble-only.
- The coupling is chord-first for *direction* and melody-first for everything else — still not the
  full joint optimisation (no search over both), just a one-way bias computed from
  direction-independent harmony. Cheap and predictable, and melody fingering visibly changes near
  written chords (Òran's stray push becomes a pull), which is the point — it is a change to the
  core treble tab, not only the bass line.
- The direction-bias weights (`written` vs `fallback` strength in `src/engine/cost.ts`) and the
  `matchScore` weights are hand-tuned first passes, to be adjusted against fixtures like the
  reversal/air terms before they are considered final.
- **Explicitly deferred:** full joint optimisation (chord *demand* reshaping which chords get
  chosen, not just direction); manual bass/chord overrides and pinned chords (a fast-follow
  mirroring the treble's pin-and-recompute, Invariant 4 — the `pinned` harmony tier and the
  discrete rendered tokens are already in place for it); accompaniment confidence marking (a forced
  clash like `d` for a written Dm the box cannot play is shown the same as an exact match);
  12-button bass; a better no-symbols fallback; and any oom-pah *rhythm* model — the engine answers
  "best bass and best chord for this span and direction", not which beats get which.
