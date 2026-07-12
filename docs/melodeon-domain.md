# Melodeon domain reference

Deeper background than CLAUDE.md carries. Read before working on domain, engine, or bass-end code.

## Instrument

Diatonic, bisonoric button accordion. Reference layout for MVP: D/G (standard English session box) — two treble rows of 10–11 buttons tuned a fourth apart, G row and D row, often with accidental buttons at row tops. Other systems exist (G/C, C/F, A/D; Irish B/C and C#/D are semitone systems played in a fundamentally different chromatic style — out of scope, and fingering heuristics do not transfer). Layouts are configurable data; D/G is merely the first instance.

## Bisonoric consequences

- A note in ABC maps to a set of (row, button, direction) candidates: often 1–3, sometimes 0 (diatonic gap). Unplayable notes are expected on real tunes and must be rendered visibly, not fail.
- Reversals: the same pitch available in the opposite direction on the other row. Exploiting these is central to fingering.
- Cross-rowing (borrowing from the other row) trades the idiomatic in-row push-pull bounce for bellows smoothness. Neither is "correct" — it is style, hence configurable cost weights, not rules.

## Bass end (post-MVP, but shapes the data model)

- Typically 8 (sometimes 12) buttons in bass/chord pairs, bisonoric like the treble.
- On a common D/G box: D and C chords available in **both** directions; G push-only; A pull-only; E (pull) and B (push) usable as minors when thirds are removed. Many players remove thirds, making chords ambiguous (a bare D–A dyad labels as D or Dm by context).
- Cross-row bass hacks approximate missing chords, e.g. A bass + C chord ≈ Am. Therefore the model is buttons with direction→pitches maps, chord labels **derived** from simultaneous sounding pitches — cross-row combinations then work for free.
- One bellows: melody fingering and accompaniment are mutually constraining through shared direction. G-push/A-pull are the main binding cases; D/C being bidirectional keeps the cost landscape fairly flat. Honest model: joint optimisation over (fingering, accompaniment) with direction as coupling variable. Acceptable v1: melody-first, chords derived from resulting direction.
- Chord suggestion = enumerate direction-compatible left-hand button combinations (tiny space, exhaustive per beat is cheap), scored against harmony implied by the ABC.

## Fingering engine

Lattice: column per note, node per candidate, DP/Viterbi shortest path. Global optimisation matters — accept local awkwardness to avoid a worse corner later, as players do.

Musicality lives in context-dependent edge costs, especially bellows reversal:

- Reversal onto bar's beat 1: cheap, possibly slightly rewarded (encodes the idiomatic bounce without a rule).
- Reversal onto other strong beats: cheap.
- Reversal on a weak quaver mid-run: expensive — this term alone produces cross-row-for-smoothness behaviour emergently.
- Reversal at a phrase boundary (bar line, long note, rest — long note/rest ≈ breath point) is nearly free **in practice, not as a distinct cost term**: long notes and rests overwhelmingly start and end on strong beats by construction (a half note in 4/4 ends on beat 3; a bar's worth in 6/8 ends on the bar line), so the existing bar-relative beat-strength discount already covers the common case. `NoteEvent.phraseBoundaryBefore` is tracked through the engine but today only resets the bellows-air run counter (`src/engine/fingering.ts`), not the reversal cost itself — checked against all fixture tunes (jigs, reels, a march, tunes with ties and chord symbols) and this never produces a different fingering, because the only way a long note/rest could land off the strong-beat grid is an unusual tie across a bar line or genuine syncopation. Revisit only if a real tune surfaces this gap during hand-fingering (roadmap step 6) — not worth a speculative cost term with no fixture to tune it against.

Other costs: row change (the idiom knob), physical button distance, staying put on repeated notes. Presets are weight vectors: "no cross-rowing" = very high row-change cost; "smoothness" = high, beat-flattened reversal costs; "idiomatic bounce" = the reverse.

Philosophy: **don't aim to be right, aim to be confidently correctable.** No weight vector matches every player. So: (1) overrides pin a node and recompute downstream — one fix propagates; (2) where best and second-best paths are close in cost, mark those notes as low-confidence in the tab to direct attention to genuine taste calls.

Tuning: hand-finger the fixture tunes as ground truth, adjust weights until the engine mostly agrees. Logged overrides are potential per-user training data later; hand-tuned weights suffice for MVP because most notes have only 1–2 sensible candidates.

## ABC input

- abcjs for parsing (its parsed structure, not just rendering). Watch: repeats, ties, grace notes, key signature application to accidentals.
- `"G"` chord symbols are accompaniment hints; `[GBd]` bracket chords are literal simultaneous notes — treat differently. MVP ignores the former, collapses the latter to its top note (surfaced in the tab, never silent).
- Right-hand simultaneous notes must all be available in the same direction — heavily prunes candidates; some voicings are simply unplayable.

## Tab systems

Target styles: Rennie tab, Mel Biggs method, Mally's (Dave Mallinson). Common convention family: button numbers per row, row distinguished notationally (e.g. prime/dash), direction by underline/arrows/line position. Mel Biggs is **verified** against a real published example (© Mel Biggs Music, purchased sheet music, not checked into the repo; see ADR 0006) and is what `TabCell` implements: bare number = inside/D row, `(parenthesised)` = outside/G row, underline = pull. Rennie and Mally's conventions remain **unverified — check against real published examples before building each renderer.** Architecturally all are pure views over (button, row, direction, duration).

## MVP scope

In: D/G treble only (single hardcoded layout instance, configurable schema), ABC textarea input, single melody voice, one suggestion strategy (minimise reversals, tie-break in-row) as a cost function, per-note override popup with downstream recompute, one tab style, visible unplayable-note handling, localStorage persistence.

Out: bass end, layout editor/presets UI, multiple tab styles, strategy picker, smart phrasing analysis, auth/database.

Success criterion: three real session tunes produce tab a melodeon player accepts with a handful of one-click overrides.
