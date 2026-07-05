# Core data model — design (roadmap step 2)

Finalises the `src/domain` types and the D/G treble instance, and upgrades the parse
adapter to emit them. Downstream steps (candidate mapping, DP engine, renderer) depend on
these types being stable.

## Goal

Turn the first-draft placeholders (`src/domain/instrument.ts`, `src/domain/notes.ts`) and the
prototype's `PrototypeTune` into one finalised data model, backed by verified D/G instrument
data.

## Scope

In:
- Finalise instrument schema + layout helpers (`instrument.ts`).
- Encode the verified D/G 21-button treble as `DG_STANDARD` (replace the placeholder).
- Finalise note-sequence + fingering-result types (`notes.ts`).
- Migrate `parseAbc` to emit `Tune`/`NoteEvent` and **retire `PrototypeTune`**; update `App.tsx`
  and the tests to the finalised types.

Out (later steps): candidate-mapping algorithm beyond the lookup helper (step 3); DP/cost
(steps 4/6); nuanced phrase analysis (step 6); the bass end and chord accompaniment (post-MVP).

## Decisions (approved)

1. **Migrate `parseAbc` now** — one coherent model; no lingering `PrototypeTune`.
2. **Lean `Candidate`** `{ buttonId, direction }`; resolve row/position/pitch via a helper —
   single source of truth, no stale denormalised copies.
3. **Flatten chords** — MVP is monophonic. A source bracket chord `[GBd]` becomes its **highest**
   pitch (the melody note) with `flattenedChord: true` for a visible warning. `NoteEvent.pitch`
   is a single MIDI number.
4. **Integer tick durations** — `PPWN = 720` pulses per whole note (divisible by 2/3/4/8/9/16 so
   triplets are exact). The adapter converts abcjs's whole-note fractions → ticks. Avoids float
   drift in beat-strength maths.

## Instrument schema (`src/domain/instrument.ts`)

```ts
export type Direction = 'push' | 'pull'
export type Pitch = number // MIDI note number, middle C = 60

export interface Button {
  id: string         // e.g. 'd1', 'g10'
  row: number        // 0 = D row, 1 = G row
  position: number   // 1-indexed along its row
  push: Pitch[]      // pitches sounded on push (treble: 1 element; bass: several)
  pull: Pitch[]      // pitches sounded on pull
}

export interface Keyboard { buttons: Button[] }

export interface Instrument {
  id: string
  name: string
  source?: string    // citation for the pitch data
  treble: Keyboard
  bass: Keyboard     // empty for MVP; schema supports it
}

export interface Candidate {
  buttonId: string
  direction: Direction
}

// Layout knowledge lives ONLY here (Invariant 1).
export function pitchesInDirection(button: Button, dir: Direction): Pitch[]
export function resolveCandidate(instrument: Instrument, c: Candidate): {
  button: Button; row: number; position: number; pitch: Pitch
}
// candidate enumeration (feasibility test lives in step 3, helper seeded here):
export function candidatesForPitch(instrument: Instrument, midi: Pitch): Candidate[]
```

`resolveCandidate` returns the single treble pitch for that button+direction (treble buttons
sound one pitch per direction). `candidatesForPitch` scans treble buttons for a direction whose
pitch equals `midi`; an empty result is a diatonic gap (expected, surfaced, never an error).

## D/G instance data (`DG_STANDARD`) — verified

Source: lesterbailey.org "D/G 21 with low notes", transcribed and confirmed 2026-07-05.
MIDI with middle C = 60. Row 0 = D row (outer, 11 buttons, push spells D major); row 1 = G row
(inner, 10 buttons, push spells G major).

D row (`d1`..`d11`) — push / pull MIDI:

| pos | push | pull |
|--|--|--|
| 1 | 54 (F#3) | 57 (A3) |
| 2 | 57 (A3) | 61 (C#4) |
| 3 | 62 (D4) | 64 (E4) |
| 4 | 66 (F#4) | 67 (G4) |
| 5 | 69 (A4) | 71 (B4) |
| 6 | 74 (D5) | 73 (C#5) |
| 7 | 78 (F#5) | 76 (E5) |
| 8 | 81 (A5) | 79 (G5) |
| 9 | 86 (D6) | 83 (B5) |
| 10 | 90 (F#6) | 85 (C#6) |
| 11 | 93 (A6) | 88 (E6) |

G row (`g1`..`g10`) — push / pull MIDI:

| pos | push | pull |
|--|--|--|
| 1 | 59 (B3) | 62 (D4) |
| 2 | 62 (D4) | 66 (F#4) |
| 3 | 67 (G4) | 69 (A4) |
| 4 | 71 (B4) | 72 (C5) |
| 5 | 74 (D5) | 76 (E5) |
| 6 | 79 (G5) | 78 (F#5) |
| 7 | 83 (B5) | 81 (A5) |
| 8 | 86 (D6) | 84 (C6) |
| 9 | 91 (G6) | 88 (E6) |
| 10 | 95 (B6) | 90 (F#6) |

Each button's `push`/`pull` is a one-element array of the MIDI value above. Bass keyboard is
empty for MVP.

## Note-sequence types (`src/domain/notes.ts`)

```ts
export const PPWN = 720 // pulses per whole note

export interface NoteEvent {
  index: number
  pitch: number            // sounding MIDI; melody note only
  writtenName: string      // e.g. 'd', '^A' — display/debug
  durationTicks: number    // PPWN-based
  startTicks: number       // cumulative from tune start
  bar: number
  startChar: number        // source offset in the ABC → override identity (step 7)
  rest: boolean            // true = rest: kept in timeline, excluded from lattice
  flattenedChord?: boolean // a source bracket chord reduced to its top note
  beatStrength: number     // basic now (metre + bar position); refined in step 6
  phraseBoundaryBefore: boolean // simple bar/rest heuristic now; refined in step 6
}

export interface BarMarker {
  beforeNoteIndex: number
  type: string             // abcjs bar type: 'bar_thin' | 'bar_left_repeat' | ...
  startEnding?: string
  endEnding?: boolean
}

export interface Tune {
  title: string
  key: string
  metre: [number, number]
  notes: NoteEvent[]       // written order (ADR 0006: no unroll)
  bars: BarMarker[]        // repeat/ending structure for the renderer
}
```

Rests are `NoteEvent`s with `rest: true` and `pitch` unused (0); they are skipped by the
fingering lattice but set `phraseBoundaryBefore` on the following note (rest ≈ breath point).
`beatStrength` is a placeholder scale (e.g. bar-beat 1 highest, other strong beats, weak
offbeats) computed from `metre` + tick position; the nuanced version is step 6.

## Fingering-result types (`src/domain/notes.ts`)

```ts
export interface FingeredNote {
  noteIndex: number
  chosen: Candidate | null   // null = unplayable diatonic gap, rendered visibly
  alternatives: Candidate[]
  pinned: boolean            // user override (hard constraint, ADR 0005)
  confidence: number
  costMargin: number         // best vs second-best path cost → low-confidence marking (step 7)
}

export interface FingeringResult {
  tune: Tune
  notes: FingeredNote[]
}

export interface CostContext {
  metre: [number, number]
  beatStrength: number
  phraseBoundaryBefore: boolean
}

export type CostFn = (from: Candidate | null, to: Candidate, context: CostContext) => number
```

## Adapter migration (`src/parse/parseAbc.ts`)

`parseAbc(abc): Tune[]` (was `PrototypeTune[]`). Changes:
- Convert `duration` (whole-note fraction) → `durationTicks` via `PPWN`; accumulate `startTicks`.
- Emit single `pitch` = `Math.max(...midiPitches)` (highest/melody note); set `flattenedChord`
  when the source note had >1 pitch. Keep tie-merge (one action) and repeat-dedupe behaviour.
- Populate `writtenName` (first written name), `startChar`, `rest`.
- Compute basic `beatStrength` (from metre + tick-position-in-bar) and
  `phraseBoundaryBefore` (bar line or preceding rest/long note).
- `key`/`metre`: keep the guarded `keyLabel`; `metre` becomes `[num, den]` (was a string).
- `App.tsx` consumes `Tune`; the sounding-name column uses `midiToName(note.pitch)`.

## Testing

- Keep the existing `parseAbc` fixtures/tests, updated to the new shape (pitch is now a single
  number; assert `durationTicks` e.g. quaver = `PPWN/8 = 90`).
- Add `instrument.test.ts`: `candidatesForPitch(DG_STANDARD, midi)` returns the expected
  (button, direction) set for a few known pitches (e.g. D4 = 62 appears as d3-push, g1-pull,
  g2-push), and returns `[]` for a diatonic gap.
- Retain the tie-merge and key-guard regression tests.

## Out of scope / deferred

Bass data; candidate feasibility pruning by same-direction chords (step 3); DP and real cost
weights (steps 4/6); nuanced phrase-boundary analysis (step 6); overrides UI (step 7).
