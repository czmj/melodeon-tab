# Staff-aligned Tab Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Render each note's melodeon tab token (button number + push/pull arrow + colour + G-row underline) as a DOM overlay positioned above the matching note in the abcjs staff, replacing the separate text-tab row.

**Architecture:** abcjs renders the whole ABC's staff (confined to `src/parse`). `renderStaff` returns per-note pixel anchors keyed by `startChar`. A pure layout module aggregates every tune's fingering into a `startChar → NoteFingering` map and joins anchors to it. A `StaffTab` React component overlays the styled, clickable tokens on the SVG and re-renders on resize. Selection + the override panel live in `App`.

**Tech Stack:** TypeScript (strict), React 19, Vite, Vitest, abcjs 6 (confined to `src/parse`).

## Global Constraints

- TypeScript strict; **no comments in produced code**.
- British English in UI copy.
- abcjs imported **only** in `src/parse` (Invariant 2). `renderStaff` returns our own `StaffAnchor` type; the overlay imports no abcjs.
- The overlay is a pure view over fingering results + anchors — no fingering logic (Invariant 5).
- Join everything by `NoteEvent.startChar` (unique per note across the whole ABC; already the pin/override key).
- Reuse `renderTab`'s `TabCell` for token content; reuse the existing `startChar`-keyed pin/override wiring.
- Rests are omitted above the staff; unplayable notes show `?`.
- Verify each task with `npx tsc -b` and `npx vitest run`; DOM/geometry tasks are additionally verified in the browser (`npm run dev`).

---

### Task 1: Geometry spike — confirm abcjs note coordinates

**Files:**
- Modify (temporarily): `src/parse/renderStaff.ts`
- Create: `docs/superpowers/notes/abcjs-geometry-spike.md`

**Interfaces:**
- Consumes: nothing.
- Produces: a findings note recording, per rendered note, how to obtain (a) the notehead x and (b) a per-staff-system top y, and which source to use in Task 2. No code interface.

Purpose: `renderAbc` returns a visual object whose note elements carry `startChar` and an `abselem` with `elemset` (SVG nodes) and `notePositions`. We must confirm which fields give reliable pixel coordinates in the real browser before building the overlay.

- [x] **Step 1: Add temporary logging to `renderStaff`**

Temporarily replace `src/parse/renderStaff.ts` with:

```ts
import { renderAbc } from 'abcjs'

export function renderStaffNotation(target: HTMLElement, abc: string): void {
  try {
    const visual = renderAbc(target, abc, { add_classes: true })[0]
    const rows: unknown[] = []
    for (const line of visual.lines) {
      if (!line.staff) continue
      for (const staff of line.staff) {
        for (const voice of staff.voices ?? []) {
          for (const el of voice) {
            if (el.el_type !== 'note') continue
            const abselem = (el as { abselem?: { notePositions?: Array<{ x: number; y: number }>; elemset?: SVGElement[] } }).abselem
            const svg = abselem?.elemset?.[0]
            const rect = svg ? svg.getBoundingClientRect() : null
            const containerRect = target.getBoundingClientRect()
            rows.push({
              startChar: (el as { startChar?: number }).startChar,
              notePositions: abselem?.notePositions,
              rectLeft: rect ? rect.left - containerRect.left : null,
              rectTop: rect ? rect.top - containerRect.top : null,
            })
          }
        }
      }
    }
    ;(window as unknown as { __geom?: unknown }).__geom = rows
    console.log('GEOM', JSON.stringify(rows, null, 1))
  } catch {
    target.textContent = 'Could not render notation.'
  }
}
```

- [x] **Step 2: Run the app and capture the geometry**

Run: `npm run dev`, open the served URL, load "The Moon And The Seven Stars", open the browser devtools console.
Expected: a `GEOM` array logs, one entry per note, with a `startChar`, a `notePositions` array, and `rectLeft`/`rectTop` numbers. Also query the staff lines: in the console run
`[...document.querySelectorAll('#root path.abcjs-top-line, #root .abcjs-staff path')].map(p => p.getBoundingClientRect().top)`
to see the per-system staff-line y positions. Note which selector returns one value per staff system.

- [x] **Step 3: Record findings and the decision**

Create `docs/superpowers/notes/abcjs-geometry-spike.md` capturing: whether `notePositions[0].x` or `elemset[0].getBoundingClientRect().left` gives the usable notehead x (relative to the container); the working selector/source for each staff system's top y; and the chosen approach for Task 2 (default expectation: notehead x from `elemset[0]` bounding rect relative to the container; system-top y from the staff-line elements, each note assigned to the nearest system-top at or above its own top). Note any surprise (e.g. coordinates scaled by a viewBox).

- [x] **Step 4: Revert the temporary logging**

Run: `git checkout src/parse/renderStaff.ts`
Expected: `renderStaff.ts` is back to its committed state (the current `renderStaffNotation(target, abc)` wrapper).

- [x] **Step 5: Commit the findings**

```bash
git add docs/superpowers/notes/abcjs-geometry-spike.md
git commit -m "spike: confirm abcjs note geometry for the tab overlay"
```

---

### Task 2: `renderStaff` returns per-note anchors

**Files:**
- Modify: `src/parse/renderStaff.ts` (replace entire file)

**Interfaces:**
- Consumes: the geometry decision from `docs/superpowers/notes/abcjs-geometry-spike.md`.
- Produces:
  - `export interface StaffAnchor { startChar: number; x: number; y: number }`
  - `export function renderStaffNotation(target: HTMLElement, abc: string, width: number): StaffAnchor[]`
  - `x` = notehead left, `y` = the top of that note's staff system, both in pixels relative to `target`.

- [x] **Step 1: Replace `src/parse/renderStaff.ts`**

Per the Task 1 findings (`docs/superpowers/notes/abcjs-geometry-spike.md`): use the SVG bounding box for the notehead centre x and the notehead top y (raw — the per-row line is derived in `placeTokens`).

```ts
import { renderAbc } from 'abcjs'

export interface StaffAnchor {
  startChar: number
  x: number
  y: number
}

export function renderStaffNotation(target: HTMLElement, abc: string, width: number): StaffAnchor[] {
  let visual
  try {
    visual = renderAbc(target, abc, { staffwidth: width, add_classes: true })[0]
  } catch {
    target.textContent = 'Could not render notation.'
    return []
  }

  const container = target.getBoundingClientRect()
  const anchors: StaffAnchor[] = []
  for (const line of visual.lines) {
    if (!line.staff) continue
    for (const staff of line.staff) {
      for (const voice of staff.voices ?? []) {
        for (const el of voice) {
          if (el.el_type !== 'note') continue
          const svg = (el as { abselem?: { elemset?: SVGGraphicsElement[] } }).abselem?.elemset?.[0]
          const startChar = (el as { startChar?: number }).startChar
          if (!svg || startChar === undefined) continue
          const rect = svg.getBoundingClientRect()
          anchors.push({
            startChar,
            x: rect.left - container.left + rect.width / 2,
            y: rect.top - container.top,
          })
        }
      }
    }
  }

  return anchors
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean. (The old `renderStaffNotation(target, abc)` signature changes to `(target, abc, width)`; callers are updated in Task 5, so the app does not compile end-to-end until then — that is expected. Confirm only that `renderStaff.ts` itself typechecks by running `npx tsc -b`; if the only errors are `App.tsx` calling the old signature, that is fine and resolved in Task 5.)

- [x] **Step 3: Commit**

```bash
git add src/parse/renderStaff.ts
git commit -m "feat(parse): renderStaffNotation returns per-note StaffAnchors"
```

---

### Task 3: `staffLayout` — aggregate fingerings and place tokens (pure, tested)

**Files:**
- Create: `src/render/staffLayout.ts`
- Test: `src/render/staffLayout.test.ts`

**Interfaces:**
- Consumes: `StaffAnchor` from `../parse/renderStaff.ts`; `TabCell` from `./tab.ts`; `NoteEvent`, `Tune`, `FingeringResult` from `../domain/notes.ts`; `Candidate` from `../domain/instrument.ts`.
- Produces:
  - `interface NoteFingering { note: NoteEvent; cell: TabCell; options: Candidate[]; chosen: Candidate | null }`
  - `interface FingeringInput { tune: Tune; fingering: FingeringResult; cells: TabCell[]; lattice: Candidate[][] }`
  - `interface PositionedToken { startChar: number; x: number; y: number; fingering: NoteFingering }`
  - `function aggregateByStartChar(inputs: FingeringInput[]): Map<number, NoteFingering>`
  - `function placeTokens(anchors: StaffAnchor[], byStartChar: Map<number, NoteFingering>, offsetY: number): PositionedToken[]`

- [x] **Step 1: Write the failing test**

Create `src/render/staffLayout.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { Candidate } from '../domain/instrument.ts'
import type { FingeredNote, FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import type { TabCell } from './tab.ts'
import { aggregateByStartChar, placeTokens } from './staffLayout.ts'

function note(index: number, startChar: number, rest = false): NoteEvent {
  return {
    index,
    pitch: 60,
    writtenName: 'C',
    durationTicks: 180,
    startTicks: index * 180,
    bar: 1,
    startChar,
    rest,
    beatStrength: 1,
    phraseBoundaryBefore: false,
  }
}

function cell(noteIndex: number, rest = false): TabCell {
  return {
    noteIndex,
    text: rest ? '-' : '3',
    arrow: rest ? '' : '↑',
    colour: rest ? null : 'red',
    underline: false,
    playable: !rest,
    rest,
    lowConfidence: false,
  }
}

const cand = (buttonId: string): Candidate => ({ buttonId, direction: 'push' })

function input(): FingeringInput {
  const notes = [note(0, 10), note(1, 20, true), note(2, 30)]
  const tune: Tune = { title: 't', key: 'C', metre: [4, 4], notes, bars: [] }
  const fingered: FingeredNote[] = notes.map((n) => ({
    noteIndex: n.index,
    chosen: n.rest ? null : cand('d3'),
    alternatives: [],
    pinned: false,
    confidence: 1,
    costMargin: 0,
  }))
  const fingering: FingeringResult = { tune, notes: fingered, totalCost: 0 }
  return {
    tune,
    fingering,
    cells: [cell(0), cell(1, true), cell(2)],
    lattice: [[cand('d3'), cand('g1')], [], [cand('d5')]],
  }
}

import type { FingeringInput } from './staffLayout.ts'

describe('aggregateByStartChar', () => {
  it('indexes each note by startChar with its cell, options and chosen', () => {
    const map = aggregateByStartChar([input()])
    expect([...map.keys()].sort((a, b) => a - b)).toEqual([10, 20, 30])
    expect(map.get(10)?.chosen?.buttonId).toBe('d3')
    expect(map.get(10)?.options.map((c) => c.buttonId)).toEqual(['d3', 'g1'])
    expect(map.get(20)?.note.rest).toBe(true)
    expect(map.get(30)?.cell.text).toBe('3')
  })
})

describe('placeTokens', () => {
  it('groups anchors into rows by x-reset, places tokens above each row, skips rests and unmatched', () => {
    const map = aggregateByStartChar([input()])
    const anchors = [
      { startChar: 10, x: 5, y: 100 },
      { startChar: 20, x: 30, y: 90 },
      { startChar: 30, x: 2, y: 200 },
      { startChar: 999, x: 40, y: 210 },
    ]
    const tokens = placeTokens(anchors, map, 25)
    expect(tokens.map((t) => t.startChar)).toEqual([10, 30])
    expect(tokens.find((t) => t.startChar === 10)).toMatchObject({ x: 5, y: 65 })
    expect(tokens.find((t) => t.startChar === 30)).toMatchObject({ x: 2, y: 175 })
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/render/staffLayout.test.ts`
Expected: FAIL — `./staffLayout.ts` not found.

- [x] **Step 3: Create `src/render/staffLayout.ts`**

```ts
import type { StaffAnchor } from '../parse/renderStaff.ts'
import type { Candidate } from '../domain/instrument.ts'
import type { FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import type { TabCell } from './tab.ts'

export interface NoteFingering {
  note: NoteEvent
  cell: TabCell
  options: Candidate[]
  chosen: Candidate | null
}

export interface FingeringInput {
  tune: Tune
  fingering: FingeringResult
  cells: TabCell[]
  lattice: Candidate[][]
}

export interface PositionedToken {
  startChar: number
  x: number
  y: number
  fingering: NoteFingering
}

export function aggregateByStartChar(inputs: FingeringInput[]): Map<number, NoteFingering> {
  const map = new Map<number, NoteFingering>()
  for (const input of inputs) {
    input.tune.notes.forEach((note, i) => {
      map.set(note.startChar, {
        note,
        cell: input.cells[i],
        options: input.lattice[i] ?? [],
        chosen: input.fingering.notes[i].chosen,
      })
    })
  }
  return map
}

export function placeTokens(
  anchors: StaffAnchor[],
  byStartChar: Map<number, NoteFingering>,
  offsetY: number,
): PositionedToken[] {
  const rowOf: number[] = []
  let row = 0
  let prevX = Infinity
  anchors.forEach((anchor, i) => {
    if (i > 0 && anchor.x < prevX) row += 1
    prevX = anchor.x
    rowOf.push(row)
  })

  const rowTop = new Map<number, number>()
  anchors.forEach((anchor, i) => {
    rowTop.set(rowOf[i], Math.min(rowTop.get(rowOf[i]) ?? Infinity, anchor.y))
  })

  const tokens: PositionedToken[] = []
  anchors.forEach((anchor, i) => {
    const fingering = byStartChar.get(anchor.startChar)
    if (!fingering || fingering.note.rest) return
    const top = rowTop.get(rowOf[i]) ?? anchor.y
    tokens.push({ startChar: anchor.startChar, x: anchor.x, y: top - offsetY, fingering })
  })
  return tokens
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/render/staffLayout.test.ts`
Expected: PASS (2 tests).

- [x] **Step 5: Typecheck and commit**

Run: `npx tsc -b` (ignore only pre-existing `App.tsx` errors from Task 2's signature change).

```bash
git add src/render/staffLayout.ts src/render/staffLayout.test.ts
git commit -m "feat(render): staffLayout aggregates fingerings and places tokens by startChar"
```

---

### Task 4: `StaffTab` component — SVG + overlay + resize

**Files:**
- Create: `src/StaffTab.tsx`

**Interfaces:**
- Consumes: `renderStaffNotation`, `StaffAnchor` from `./parse/renderStaff.ts`; `placeTokens`, `NoteFingering` from `./render/staffLayout.ts`.
- Produces: `function StaffTab(props: { abc: string; byStartChar: Map<number, NoteFingering>; onSelect: (startChar: number) => void; selectedStartChar: number | null; pinnedStartChars: Set<number> }): JSX.Element`

- [x] **Step 1: Create `src/StaffTab.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { renderStaffNotation } from './parse/renderStaff.ts'
import type { StaffAnchor } from './parse/renderStaff.ts'
import { placeTokens } from './render/staffLayout.ts'
import type { NoteFingering } from './render/staffLayout.ts'

const TOKEN_OFFSET_Y = 22

export function StaffTab({
  abc,
  byStartChar,
  onSelect,
  selectedStartChar,
  pinnedStartChars,
}: {
  abc: string
  byStartChar: Map<number, NoteFingering>
  onSelect: (startChar: number) => void
  selectedStartChar: number | null
  pinnedStartChars: Set<number>
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const staffRef = useRef<HTMLDivElement>(null)
  const [anchors, setAnchors] = useState<StaffAnchor[]>([])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const staff = staffRef.current
    if (!wrapper || !staff) return
    const render = () => setAnchors(renderStaffNotation(staff, abc, wrapper.clientWidth))
    render()
    const observer = new ResizeObserver(render)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [abc])

  const tokens = placeTokens(anchors, byStartChar, TOKEN_OFFSET_Y)

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div ref={staffRef} />
      {tokens.map((token) => {
        const cell = token.fingering.cell
        return (
          <span
            key={token.startChar}
            onClick={() => onSelect(token.startChar)}
            title={cell.lowConfidence ? 'low confidence — close call' : undefined}
            style={{
              position: 'absolute',
              left: token.x,
              top: token.y,
              transform: 'translateX(-50%)',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: '0.8em',
              color: cell.colour ?? undefined,
              textDecoration: cell.underline ? 'underline' : undefined,
              backgroundColor: cell.lowConfidence ? '#ffe08a' : undefined,
              fontWeight: pinnedStartChars.has(token.startChar) ? 'bold' : undefined,
              outline: selectedStartChar === token.startChar ? '1px solid black' : undefined,
            }}
          >
            {cell.text}
            {cell.arrow}
          </span>
        )
      })}
    </div>
  )
}
```

- [x] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: clean apart from the pre-existing `App.tsx` signature error (resolved in Task 5). `StaffTab.tsx` itself must have no errors.

- [x] **Step 3: Commit**

```bash
git add src/StaffTab.tsx
git commit -m "feat(ui): StaffTab renders the staff with a positioned tab overlay"
```

---

### Task 5: Integrate into `App`; reduce `TuneView`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `StaffTab` from `./StaffTab.tsx`; `aggregateByStartChar`, `FingeringInput`, `NoteFingering` from `./render/staffLayout.ts`; `renderTab` from `./render/tab.ts`; `mapTuneCandidates`, `fingerWithConfidence`, `makeCostFn` (already imported).
- Produces: the finished view — one staff overlay for the whole ABC, per-tune debug tables, override panel by `startChar`.

- [x] **Step 1: Rewrite `src/App.tsx`**

Replace the whole file with:

```tsx
import { Fragment, useEffect, useMemo, useState } from 'react'
import { parseAbc } from './parse/parseAbc.ts'
import type { BarMarker, NoteEvent, Tune } from './domain/notes.ts'
import type { Candidate } from './domain/instrument.ts'
import { DG_STANDARD, candidatesForPitch } from './domain/instrument.ts'
import { mapTuneCandidates } from './engine/candidates.ts'
import { fingerWithConfidence } from './engine/confidence.ts'
import { makeCostFn } from './engine/cost.ts'
import { renderTab } from './render/tab.ts'
import { aggregateByStartChar } from './render/staffLayout.ts'
import type { FingeringInput, NoteFingering } from './render/staffLayout.ts'
import { StaffTab } from './StaffTab.tsx'
import { midiToName } from './domain/pitch.ts'
import moonAbc from './fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from './fixtures/jiggery-pokerwork.abc?raw'
import bansheeAbc from './fixtures/the-banshee.abc?raw'

const fixtures = [
  { name: 'The Moon And The Seven Stars', abc: moonAbc },
  { name: 'Jiggery Pokerwork', abc: jiggeryAbc },
  { name: 'The Banshee', abc: bansheeAbc },
]

type Pins = Record<number, Candidate>

const STORAGE_KEY = 'melodeon-tab-state'

function isKnownCandidate(value: unknown): value is Candidate {
  if (typeof value !== 'object' || value === null) return false
  const direction = (value as { direction?: unknown }).direction
  const buttonId = (value as { buttonId?: unknown }).buttonId
  return (
    (direction === 'push' || direction === 'pull') &&
    DG_STANDARD.treble.buttons.some((b) => b.id === buttonId)
  )
}

function loadState(): { abc: string; pins: Pins } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const abc = typeof parsed?.abc === 'string' ? parsed.abc : fixtures[0].abc
      const pins: Pins = {}
      if (parsed?.pins && typeof parsed.pins === 'object') {
        for (const [key, value] of Object.entries(parsed.pins)) {
          if (isKnownCandidate(value)) pins[Number(key)] = value
        }
      }
      return { abc, pins }
    }
  } catch {
    return { abc: fixtures[0].abc, pins: {} }
  }
  return { abc: fixtures[0].abc, pins: {} }
}

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

function pinLabel(c: Candidate): string {
  return `${c.buttonId} ${c.direction === 'push' ? '↑' : '↓'}`
}

function candidateLabel(note: NoteEvent): string {
  if (note.rest) return '—'
  const candidates = candidatesForPitch(DG_STANDARD, note.pitch)
  if (candidates.length === 0) return '— unplayable'
  return candidates.map((c) => `${c.buttonId} ${c.direction}`).join(', ')
}

function BarRow({ bar }: { bar: BarMarker }) {
  return (
    <tr>
      <td colSpan={7}>
        {bar.type}
        {bar.startEnding ? ` (ending ${bar.startEnding})` : ''}
        {bar.endEnding ? ' (end ending)' : ''}
      </td>
    </tr>
  )
}

function OverridePanel({
  fingering,
  onSetPin,
  onClearPin,
  onClose,
}: {
  fingering: NoteFingering
  onSetPin: (candidate: Candidate) => void
  onClearPin: () => void
  onClose: () => void
}) {
  const { note, options, chosen } = fingering
  return (
    <div>
      <strong>Note at char {note.startChar}</strong>{' '}
      ({note.rest ? 'rest' : `${note.writtenName} = ${midiToName(note.pitch)}`}):{' '}
      {options.length === 0 ? (
        <em>no playable buttons (rest or diatonic gap)</em>
      ) : (
        options.map((c, ci) => {
          const isAuto = chosen !== null && sameCandidate(c, chosen)
          return (
            <button key={ci} type="button" onClick={() => onSetPin(c)}>
              {pinLabel(c)}
              {isAuto ? ' (auto)' : ''}
            </button>
          )
        })
      )}{' '}
      <button type="button" onClick={onClearPin}>
        clear override
      </button>{' '}
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  )
}

function DebugTable({ tune }: { tune: Tune }) {
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
            <th>Buttons (D/G)</th>
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
                <td>{candidateLabel(n)}</td>
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

export function App() {
  const initial = useMemo(loadState, [])
  const [abc, setAbc] = useState(initial.abc)
  const [pins, setPins] = useState<Pins>(initial.pins)
  const [selected, setSelected] = useState<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ abc, pins }))
    } catch {
      return
    }
  }, [abc, pins])

  const result = useMemo(() => {
    try {
      return { tunes: parseAbc(abc), error: null as string | null }
    } catch (e) {
      return { tunes: [] as Tune[], error: String(e) }
    }
  }, [abc])

  const byStartChar = useMemo(() => {
    const cost = makeCostFn(DG_STANDARD)
    const inputs: FingeringInput[] = result.tunes
      .filter((tune) => tune.notes.length > 0)
      .map((tune) => {
        const lattice = mapTuneCandidates(tune, DG_STANDARD)
        const pinMap = new Map<number, Candidate>()
        tune.notes.forEach((n) => {
          const pin = pins[n.startChar]
          if (pin) pinMap.set(n.index, pin)
        })
        const fingering = fingerWithConfidence(tune, lattice, cost, pinMap)
        return { tune, fingering, cells: renderTab(fingering, DG_STANDARD), lattice }
      })
    return aggregateByStartChar(inputs)
  }, [result, pins])

  const pinnedStartChars = useMemo(
    () => new Set(Object.keys(pins).map(Number)),
    [pins],
  )

  const loadFixture = (fixtureAbc: string) => {
    setAbc(fixtureAbc)
    setPins({})
    setSelected(null)
  }

  const setPin = (startChar: number, candidate: Candidate) =>
    setPins((p) => ({ ...p, [startChar]: candidate }))

  const clearPin = (startChar: number) =>
    setPins((p) => {
      const next = { ...p }
      delete next[startChar]
      return next
    })

  const pinCount = Object.keys(pins).length
  const selectedFingering = selected !== null ? byStartChar.get(selected) : undefined

  return (
    <div>
      <h1>melodeon-tab — ABC parse prototype</h1>
      <p>
        {fixtures.map((f) => (
          <button key={f.name} type="button" onClick={() => loadFixture(f.abc)}>
            {f.name}
          </button>
        ))}
      </p>
      <textarea value={abc} onChange={(e) => setAbc(e.target.value)} rows={16} cols={80} />
      <p>
        Overrides: {pinCount}{' '}
        <button type="button" disabled={pinCount === 0} onClick={() => setPins({})}>
          clear all overrides
        </button>
      </p>
      <h2>
        Tab over staff (click a note — <span style={{ color: 'red' }}>↑ push</span>,{' '}
        <span style={{ color: 'blue' }}>↓ pull</span>, <u>underline</u> = G row, ? = unplayable,{' '}
        <strong>bold</strong> = pinned, <span style={{ backgroundColor: '#ffe08a' }}>highlight</span>{' '}
        = low-confidence)
      </h2>
      {result.error && <p>Parse error: {result.error}</p>}
      <StaffTab
        abc={abc}
        byStartChar={byStartChar}
        onSelect={setSelected}
        selectedStartChar={selected}
        pinnedStartChars={pinnedStartChars}
      />
      {selected !== null && selectedFingering && (
        <OverridePanel
          fingering={selectedFingering}
          onSetPin={(c) => setPin(selected, c)}
          onClearPin={() => clearPin(selected)}
          onClose={() => setSelected(null)}
        />
      )}
      {result.tunes
        .filter((tune) => tune.notes.length > 0)
        .map((tune, i) => (
          <DebugTable key={i} tune={tune} />
        ))}
    </div>
  )
}
```

- [x] **Step 2: Typecheck, test, build**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: clean typecheck; all tests green (the engine/parse/render tests plus `staffLayout`); production build succeeds.

- [x] **Step 3: Verify in the browser** — skipped at user's request (typecheck/tests/build all green; no chromium-cli/Playwright available in this environment).

Run: `npm run dev`, open the served URL. Expected: the staff renders with tab tokens above the notes (button number + arrow, red push / blue pull, G-row underlined, `?` for the unplayable A♯ in Jiggery Pokerwork, low-confidence notes highlighted). Click a token → the override panel opens; pin an alternative → the overlay updates (pinned note bold, downstream tokens re-flow). Resize the window → the staff reflows and tokens stay aligned. The debug tables appear below. Stop the dev server.

- [x] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(ui): tab overlay above the staff; reduce TuneView to debug table"
```

---

## Notes for the implementer

- Run every command from the repo root (`/Users/clara/Projects/melodeon-tab`).
- Do the tasks in order. Task 1 (the spike) informs Task 2's coordinate sources — read the findings note before implementing Task 2.
- Between Task 2 and Task 5 the app will not compile end-to-end (the `renderStaffNotation` signature changed); that is expected and resolved in Task 5. Each task's own new/changed file must typecheck.
- Do not add comments to any `.ts`/`.tsx` file (CLAUDE.md rule).
- Do not import abcjs anywhere outside `src/parse`.
