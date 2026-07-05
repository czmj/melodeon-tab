# Core Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finalise the `src/domain` data model (instrument schema + verified D/G instance, note-sequence types, fingering-result types) and migrate the parse adapter to emit it, retiring the prototype's `PrototypeTune`.

**Architecture:** Three layered modules. `src/domain/instrument.ts` holds the instrument schema, the verified D/G layout data, and layout helpers (the only place with button/pitch knowledge). `src/domain/notes.ts` holds note-sequence + fingering-result types plus two pure helpers (`wholeNotesToTicks`, `basicBeatStrength`). `src/parse/parseAbc.ts` (abcjs-confined) consumes both and emits `Tune[]`. React `App.tsx` is a pure view over `Tune`.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest, abcjs 6 (confined to `src/parse`).

## Global Constraints

- TypeScript strict; **no comments in produced code**.
- British English in UI copy.
- abcjs may be imported **only** in `src/parse` (Invariant 2).
- Layout/button/pitch knowledge lives **only** in instrument layout instances (Invariant 1).
- MIDI convention: middle C = 60.
- `PPWN = 720` (pulses per whole note).
- Verify each task with `npx tsc -b` (clean) and `npx vitest run` (green) before committing.

---

### Task 1: Instrument schema, D/G data, and layout helpers

**Files:**
- Modify: `src/domain/instrument.ts` (replace entire file)
- Test: `src/domain/instrument.test.ts` (create)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Direction = 'push' | 'pull'`, `type Pitch = number`
  - `interface Button { id: string; row: number; position: number; push: Pitch[]; pull: Pitch[] }`
  - `interface Keyboard { buttons: Button[] }`
  - `interface Instrument { id: string; name: string; source?: string; treble: Keyboard; bass: Keyboard }`
  - `interface Candidate { buttonId: string; direction: Direction }`
  - `function pitchesInDirection(button: Button, direction: Direction): Pitch[]`
  - `function candidatesForPitch(instrument: Instrument, midi: Pitch): Candidate[]`
  - `function resolveCandidate(instrument: Instrument, candidate: Candidate): { button: Button; row: number; position: number; pitch: Pitch }`
  - `const DG_STANDARD: Instrument`

- [ ] **Step 1: Write the failing test**

Create `src/domain/instrument.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DG_STANDARD, candidatesForPitch, resolveCandidate } from './instrument.ts'

describe('DG_STANDARD', () => {
  it('has 21 treble buttons and an empty bass', () => {
    expect(DG_STANDARD.treble.buttons).toHaveLength(21)
    expect(DG_STANDARD.bass.buttons).toHaveLength(0)
  })

  it('finds every candidate that sounds D4 = 62 (a cross-row reversal)', () => {
    expect(candidatesForPitch(DG_STANDARD, 62)).toEqual([
      { buttonId: 'd3', direction: 'push' },
      { buttonId: 'g1', direction: 'pull' },
      { buttonId: 'g2', direction: 'push' },
    ])
  })

  it('returns an empty array for a diatonic gap (C natural = 60)', () => {
    expect(candidatesForPitch(DG_STANDARD, 60)).toEqual([])
  })

  it('resolves a candidate to its button, row, position and sounding pitch', () => {
    const r = resolveCandidate(DG_STANDARD, { buttonId: 'd3', direction: 'push' })
    expect(r.row).toBe(0)
    expect(r.position).toBe(3)
    expect(r.pitch).toBe(62)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/instrument.test.ts`
Expected: FAIL — `DG_STANDARD` / `candidatesForPitch` / `resolveCandidate` not exported.

- [ ] **Step 3: Replace `src/domain/instrument.ts`**

```ts
export type Direction = 'push' | 'pull'
export type Pitch = number

export interface Button {
  id: string
  row: number
  position: number
  push: Pitch[]
  pull: Pitch[]
}

export interface Keyboard {
  buttons: Button[]
}

export interface Instrument {
  id: string
  name: string
  source?: string
  treble: Keyboard
  bass: Keyboard
}

export interface Candidate {
  buttonId: string
  direction: Direction
}

export function pitchesInDirection(button: Button, direction: Direction): Pitch[] {
  return direction === 'push' ? button.push : button.pull
}

export function candidatesForPitch(instrument: Instrument, midi: Pitch): Candidate[] {
  const result: Candidate[] = []
  for (const button of instrument.treble.buttons) {
    if (button.push.includes(midi)) result.push({ buttonId: button.id, direction: 'push' })
    if (button.pull.includes(midi)) result.push({ buttonId: button.id, direction: 'pull' })
  }
  return result
}

export function resolveCandidate(
  instrument: Instrument,
  candidate: Candidate,
): { button: Button; row: number; position: number; pitch: Pitch } {
  const button = instrument.treble.buttons.find((b) => b.id === candidate.buttonId)
  if (!button) throw new Error(`unknown button: ${candidate.buttonId}`)
  const pitches = pitchesInDirection(button, candidate.direction)
  return { button, row: button.row, position: button.position, pitch: pitches[0] }
}

function button(id: string, row: number, position: number, push: Pitch, pull: Pitch): Button {
  return { id, row, position, push: [push], pull: [pull] }
}

const dRow: Button[] = [
  button('d1', 0, 1, 54, 57),
  button('d2', 0, 2, 57, 61),
  button('d3', 0, 3, 62, 64),
  button('d4', 0, 4, 66, 67),
  button('d5', 0, 5, 69, 71),
  button('d6', 0, 6, 74, 73),
  button('d7', 0, 7, 78, 76),
  button('d8', 0, 8, 81, 79),
  button('d9', 0, 9, 86, 83),
  button('d10', 0, 10, 90, 85),
  button('d11', 0, 11, 93, 88),
]

const gRow: Button[] = [
  button('g1', 1, 1, 59, 62),
  button('g2', 1, 2, 62, 66),
  button('g3', 1, 3, 67, 69),
  button('g4', 1, 4, 71, 72),
  button('g5', 1, 5, 74, 76),
  button('g6', 1, 6, 79, 78),
  button('g7', 1, 7, 83, 81),
  button('g8', 1, 8, 86, 84),
  button('g9', 1, 9, 91, 88),
  button('g10', 1, 10, 95, 90),
]

export const DG_STANDARD: Instrument = {
  id: 'dg-standard',
  name: 'D/G standard (21-button)',
  source: 'lesterbailey.org "D/G 21 with low notes", verified 2026-07-05',
  treble: { buttons: [...dRow, ...gRow] },
  bass: { buttons: [] },
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/instrument.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: clean (exit 0). (The old `DG_TREBLE_PLACEHOLDER` export is removed; confirm nothing imported it — `grep -rn DG_TREBLE_PLACEHOLDER src` returns nothing.)

- [ ] **Step 6: Commit**

```bash
git add src/domain/instrument.ts src/domain/instrument.test.ts
git commit -m "feat(domain): finalise instrument schema + verified D/G layout

Lean Candidate {buttonId,direction} with resolveCandidate/candidatesForPitch
helpers; DG_STANDARD 21-button treble from lesterbailey.org (verified).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Note-sequence + fingering-result types and timing helpers

**Files:**
- Modify: `src/domain/notes.ts` (replace entire file)
- Test: `src/domain/notes.test.ts` (create)

**Interfaces:**
- Consumes: `Candidate` from `./instrument`.
- Produces:
  - `const PPWN = 720`
  - `function wholeNotesToTicks(wholeNotes: number): number`
  - `function basicBeatStrength(positionInBarTicks: number, metre: [number, number]): number`
  - `interface NoteEvent { index: number; pitch: number; writtenName: string; durationTicks: number; startTicks: number; bar: number; startChar: number; rest: boolean; flattenedChord?: boolean; beatStrength: number; phraseBoundaryBefore: boolean }`
  - `interface BarMarker { beforeNoteIndex: number; type: string; startEnding?: string; endEnding?: boolean }`
  - `interface Tune { title: string; key: string; metre: [number, number]; notes: NoteEvent[]; bars: BarMarker[] }`
  - `interface FingeredNote { noteIndex: number; chosen: Candidate | null; alternatives: Candidate[]; pinned: boolean; confidence: number; costMargin: number }`
  - `interface FingeringResult { tune: Tune; notes: FingeredNote[] }`
  - `interface CostContext { metre: [number, number]; beatStrength: number; phraseBoundaryBefore: boolean }`
  - `type CostFn = (from: Candidate | null, to: Candidate, context: CostContext) => number`

- [ ] **Step 1: Write the failing test**

Create `src/domain/notes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { PPWN, basicBeatStrength, wholeNotesToTicks } from './notes.ts'

describe('wholeNotesToTicks', () => {
  it('converts common durations to integer ticks', () => {
    expect(PPWN).toBe(720)
    expect(wholeNotesToTicks(0.125)).toBe(90)
    expect(wholeNotesToTicks(0.25)).toBe(180)
    expect(wholeNotesToTicks(1 / 12)).toBe(60)
  })
})

describe('basicBeatStrength', () => {
  it('scores 4/4 positions: downbeat, on-beat, offbeat', () => {
    expect(basicBeatStrength(0, [4, 4])).toBe(1)
    expect(basicBeatStrength(180, [4, 4])).toBe(0.6)
    expect(basicBeatStrength(90, [4, 4])).toBe(0.2)
  })

  it('scores 6/8 by compound main beats (positions 0 and 3 quavers)', () => {
    expect(basicBeatStrength(0, [6, 8])).toBe(1)
    expect(basicBeatStrength(270, [6, 8])).toBe(0.6)
    expect(basicBeatStrength(90, [6, 8])).toBe(0.2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/domain/notes.test.ts`
Expected: FAIL — `PPWN` / `wholeNotesToTicks` / `basicBeatStrength` not exported.

- [ ] **Step 3: Replace `src/domain/notes.ts`**

```ts
import type { Candidate } from './instrument'

export const PPWN = 720

export function wholeNotesToTicks(wholeNotes: number): number {
  return Math.round(wholeNotes * PPWN)
}

export function basicBeatStrength(positionInBarTicks: number, metre: [number, number]): number {
  const [num, den] = metre
  const barTicks = num * (PPWN / den)
  const mainBeats = den === 8 && num % 3 === 0 ? num / 3 : num
  const mainBeatTicks = barTicks / mainBeats
  if (positionInBarTicks === 0) return 1
  if (positionInBarTicks % mainBeatTicks === 0) return 0.6
  return 0.2
}

export interface NoteEvent {
  index: number
  pitch: number
  writtenName: string
  durationTicks: number
  startTicks: number
  bar: number
  startChar: number
  rest: boolean
  flattenedChord?: boolean
  beatStrength: number
  phraseBoundaryBefore: boolean
}

export interface BarMarker {
  beforeNoteIndex: number
  type: string
  startEnding?: string
  endEnding?: boolean
}

export interface Tune {
  title: string
  key: string
  metre: [number, number]
  notes: NoteEvent[]
  bars: BarMarker[]
}

export interface FingeredNote {
  noteIndex: number
  chosen: Candidate | null
  alternatives: Candidate[]
  pinned: boolean
  confidence: number
  costMargin: number
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/domain/notes.test.ts`
Expected: PASS (2 describes, 3 assertions groups).

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc -b && npx vitest run`
Expected: clean typecheck; all tests green (instrument + notes + the still-unchanged parseAbc prototype tests).

- [ ] **Step 6: Commit**

```bash
git add src/domain/notes.ts src/domain/notes.test.ts
git commit -m "feat(domain): finalise note-sequence and fingering-result types

Integer-tick durations (PPWN=720) with wholeNotesToTicks/basicBeatStrength
helpers; NoteEvent (rest, flattenedChord, startChar, writtenName), Tune with
bars, FingeredNote with costMargin, CostFn/CostContext.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Migrate `parseAbc` to emit `Tune[]`, update tests and `App.tsx`

**Files:**
- Modify: `src/parse/parseAbc.ts` (replace entire file)
- Modify: `src/parse/parseAbc.test.ts` (update to new shape)
- Modify: `src/App.tsx` (consume `Tune`)

**Interfaces:**
- Consumes: `Tune`, `NoteEvent`, `BarMarker`, `wholeNotesToTicks`, `basicBeatStrength` from `../domain/notes`; `midiToName` from `../domain/pitch`.
- Produces: `function parseAbc(abc: string): Tune[]` (was `PrototypeTune[]`). `PrototypeTune`/`PrototypeNote`/`PrototypeBar` are removed.

Note on behaviour changes from the prototype: `pitch` is a single MIDI number (`Math.max` of the note's sounding pitches; `flattenedChord: true` when the source had >1 pitch); `durationTicks` replaces `durationWholeNotes`; `metre` is `[num, den]`; per-tune `warnings` is dropped (not in the finalised `Tune`). Tie-merge and repeat-dedupe behaviour are preserved. `phraseBoundaryBefore` is a simple heuristic — the first note, or a note preceded by a rest or a long note (≥ half note, `PPWN/2`); section-boundary and finer phrasing is roadmap step 6.

- [ ] **Step 1: Update the failing tests**

Replace `src/parse/parseAbc.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import { parseAbc } from './parseAbc.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

describe('parseAbc', () => {
  it('extracts header, notes and sounding pitch from a D major jig', () => {
    const [tune] = parseAbc(moonAbc)
    expect(tune.title).toBe('The Moon And The Seven Stars')
    expect(tune.key).toBe('Dmaj')
    expect(tune.metre).toEqual([6, 8])
    expect(tune.notes.length).toBeGreaterThan(0)

    const first = tune.notes[0]
    expect(first.writtenName).toBe('d')
    expect(first.pitch).toBe(74)
    expect(first.durationTicks).toBe(180)
    expect(first.startTicks).toBe(0)
  })

  it('applies key signature to sounding pitch (written F sounds F#)', () => {
    const [tune] = parseAbc(moonAbc)
    const f = tune.notes.find((n) => n.writtenName === 'F')
    expect(f?.pitch).toBe(66)
  })

  it('resolves explicit accidentals (^A sounds A#)', () => {
    const [tune] = parseAbc(jiggeryAbc)
    const sharpA = tune.notes.find((n) => n.writtenName === '^A')
    expect(sharpA?.pitch).toBe(70)
  })

  it('merges a tie into one note with combined duration and the sounding pitch', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nM:4/4\nK:C\nA2- A2 c4 |')
    expect(tune.notes.map((n) => n.writtenName)).toEqual(['A', 'c'])
    const a = tune.notes[0]
    expect(a.durationTicks).toBe(360)
    expect(a.pitch).toBe(69)
  })

  it('flattens a bracket chord to its highest pitch and flags it', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nK:C\n[CEG] D |')
    expect(tune.notes[0].pitch).toBe(67)
    expect(tune.notes[0].flattenedChord).toBe(true)
    expect(tune.notes[1].flattenedChord).toBeUndefined()
  })

  it('records repeat structure', () => {
    const [tune] = parseAbc(moonAbc)
    const types = tune.bars.map((b) => b.type)
    expect(types).toContain('bar_left_repeat')
    expect(types).toContain('bar_right_repeat')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/parse/parseAbc.test.ts`
Expected: FAIL — old `parseAbc` still returns `durationWholeNotes`/`midiPitches`/string metre, so `metre`/`pitch`/`durationTicks`/`flattenedChord` assertions fail.

- [ ] **Step 3: Replace `src/parse/parseAbc.ts`**

```ts
import { parseOnly } from 'abcjs'
import type { TuneObject } from 'abcjs'
import { PPWN, basicBeatStrength, wholeNotesToTicks } from '../domain/notes.ts'
import type { BarMarker, NoteEvent, Tune } from '../domain/notes.ts'

function keyLabel(tune: TuneObject): string {
  const k = tune.getKeySignature()
  const root = k.root as string | undefined
  if (!root || root === 'none') return ''
  const mode = k.mode === 'm' ? 'min' : k.mode || 'maj'
  return `${root}${mode}`
}

function metreTuple(tune: TuneObject): [number, number] {
  const m = tune.getMeterFraction()
  return [m.num, m.den ?? 4]
}

function audioPitchMap(tune: TuneObject): Map<number, number[]> {
  const map = new Map<number, number[]>()
  let audio
  try {
    audio = tune.setUpAudio({})
  } catch {
    return map
  }
  for (const track of audio.tracks) {
    for (const item of track) {
      if (item.cmd === 'note') {
        const list = map.get(item.startChar) ?? []
        if (!list.includes(item.pitch)) {
          list.push(item.pitch)
        }
        map.set(item.startChar, list)
      }
    }
  }
  return map
}

export function parseAbc(abc: string): Tune[] {
  const tunes: TuneObject[] = parseOnly(abc)
  return tunes.map((tune) => {
    const pitchMap = audioPitchMap(tune)
    const metre = metreTuple(tune)
    const notes: NoteEvent[] = []
    const bars: BarMarker[] = []
    let bar = 1
    let seenNoteInBar = false
    let startTicks = 0
    let barStartTicks = 0
    let pendingBoundary = true

    const items = tune.lines
      .flatMap((line) => line.staff ?? [])
      .flatMap((staff) => staff.voices ?? [])
      .flat()

    for (const item of items) {
      if (item.el_type === 'note') {
        const rest = item.rest !== undefined
        const pitches: Array<{ name?: string; endTie?: unknown }> = item.pitches ?? []
        const durationTicks = wholeNotesToTicks(item.duration)
        const tiedFromPrevious =
          !rest && pitches.length > 0 && pitches.every((p) => p.endTie)
        if (tiedFromPrevious && notes.length > 0) {
          notes[notes.length - 1].durationTicks += durationTicks
          startTicks += durationTicks
          seenNoteInBar = true
          continue
        }
        const midis = pitchMap.get(item.startChar) ?? []
        const writtenNames = pitches.map((p) => p.name ?? '?')
        notes.push({
          index: notes.length,
          pitch: rest || midis.length === 0 ? 0 : Math.max(...midis),
          writtenName: rest ? 'z' : writtenNames[writtenNames.length - 1] ?? '?',
          durationTicks,
          startTicks,
          bar,
          startChar: item.startChar,
          rest,
          flattenedChord: !rest && pitches.length > 1 ? true : undefined,
          beatStrength: basicBeatStrength(startTicks - barStartTicks, metre),
          phraseBoundaryBefore: pendingBoundary,
        })
        pendingBoundary = rest || durationTicks >= PPWN / 2
        startTicks += durationTicks
        seenNoteInBar = true
      } else if (item.el_type === 'bar') {
        bars.push({
          beforeNoteIndex: notes.length,
          type: item.type,
          startEnding: item.startEnding,
          endEnding: item.endEnding,
        })
        if (seenNoteInBar) {
          bar += 1
          barStartTicks = startTicks
          seenNoteInBar = false
        }
      }
    }

    return {
      title: tune.metaText.title ?? '',
      key: keyLabel(tune),
      metre,
      notes,
      bars,
    }
  })
}
```

- [ ] **Step 4: Run the parse tests to verify they pass**

Run: `npx vitest run src/parse/parseAbc.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Update `src/App.tsx` to consume `Tune`**

Change the imports near the top of `src/App.tsx` from:

```tsx
import { parseAbc } from './parse/parseAbc.ts'
import type { PrototypeTune } from './parse/parseAbc.ts'
import { renderStaffNotation } from './parse/renderStaff.ts'
import { midiToName } from './domain/pitch.ts'
```

to:

```tsx
import { parseAbc } from './parse/parseAbc.ts'
import type { BarMarker, Tune } from './domain/notes.ts'
import { renderStaffNotation } from './parse/renderStaff.ts'
import { midiToName } from './domain/pitch.ts'
```

Replace the `BarRow` component with (typed to `BarMarker`):

```tsx
function BarRow({ bar }: { bar: BarMarker }) {
  return (
    <tr>
      <td colSpan={6}>
        {bar.type}
        {bar.startEnding ? ` (ending ${bar.startEnding})` : ''}
        {bar.endEnding ? ' (end ending)' : ''}
      </td>
    </tr>
  )
}
```

Replace the whole `TuneView` component with:

```tsx
function TuneView({ tune }: { tune: Tune }) {
  const barsBefore = useMemo(() => {
    const map = new Map<number, BarMarker[]>()
    for (const b of tune.bars) {
      const list = map.get(b.beforeNoteIndex) ?? []
      list.push(b)
      map.set(b.beforeNoteIndex, list)
    }
    return map
  }, [tune])

  return (
    <div>
      <h2>{tune.title || '(untitled)'}</h2>
      <p>
        Key: {tune.key} · Metre: {tune.metre[0]}/{tune.metre[1]} · Notes: {tune.notes.length}
      </p>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>#</th>
            <th>Bar</th>
            <th>Written</th>
            <th>Sounding (MIDI)</th>
            <th>Sounding (name)</th>
            <th>Duration (ticks)</th>
          </tr>
        </thead>
        <tbody>
          {tune.notes.map((n) => (
            <Fragment key={n.index}>
              {barsBefore.get(n.index)?.map((b, i) => (
                <BarRow key={`bar-${n.index}-${i}`} bar={b} />
              ))}
              <tr>
                <td>{n.index}</td>
                <td>{n.bar}</td>
                <td>
                  {n.writtenName}
                  {n.flattenedChord ? ' (chord→top)' : ''}
                </td>
                <td>{n.rest ? '—' : n.pitch}</td>
                <td>{n.rest ? 'rest' : midiToName(n.pitch)}</td>
                <td>{n.durationTicks}</td>
              </tr>
            </Fragment>
          ))}
          {barsBefore.get(tune.notes.length)?.map((b, i) => (
            <BarRow key={`bar-end-${i}`} bar={b} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

In the `App` component, change the `result` memo's typed empty array from `PrototypeTune[]` to `Tune[]`:

```tsx
  const result = useMemo(() => {
    try {
      return { tunes: parseAbc(abc), error: null as string | null }
    } catch (e) {
      return { tunes: [] as Tune[], error: String(e) }
    }
  }, [abc])
```

(The warnings `<ul>` block was inside `TuneView` and is removed by the replacement above, since the finalised `Tune` carries no `warnings`. The rest of `App` — fixtures buttons, textarea, staff `div`, and the `result.tunes.filter((tune) => tune.notes.length > 0)` render — is unchanged.)

- [ ] **Step 6: Typecheck, full suite, build**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: clean typecheck; all tests green (instrument, notes, parseAbc); production build succeeds.

- [ ] **Step 7: Verify the app renders**

Run: `npm run dev`, open the served URL, click each fixture button. Expected: each tune shows a note table with a single MIDI value + note name per row, tick durations, bar/repeat markers, and no console errors. Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add src/parse/parseAbc.ts src/parse/parseAbc.test.ts src/App.tsx
git commit -m "feat(parse): emit finalised Tune model, retire PrototypeTune

parseAbc now returns Tune[] with integer-tick durations, single melody
pitch (Math.max, flattenedChord flag), [num,den] metre, basic beatStrength
and phraseBoundaryBefore. App.tsx consumes Tune.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Notes for the implementer

- Run every command from the repo root (`/Users/clara/Projects/melodeon-tab`).
- Do the tasks in order: Task 2 imports from Task 1's module; Task 3 imports from both.
- If `tsc -b` complains about an unused import after edits, remove it — `noUnusedLocals` is on.
- Do not add comments to any `.ts`/`.tsx` file (CLAUDE.md rule).
