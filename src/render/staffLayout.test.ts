import { describe, expect, it } from 'vitest'
import type { Candidate } from '../domain/instrument.ts'
import type { FingeredNote, FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import type { TabCell } from './tab.ts'
import { aggregateByStartChar, placeLabels, placeTokens } from './staffLayout.ts'
import type { FingeringInput } from './staffLayout.ts'
import { DG_STANDARD } from '../domain/instrument.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import { mapTuneCandidates } from '../engine/candidates.ts'
import { fingerWithConfidence } from '../engine/confidence.ts'
import { renderTab } from './tab.ts'
import christmasAbc from '../fixtures/a-christmas.abc?raw'

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
    pull: false,
    playable: !rest,
    rest,
    lowConfidence: false,
  }
}

const cand = (buttonId: string): Candidate => ({ buttonId, direction: 'push' })

function input(): FingeringInput {
  const notes = [note(0, 10), note(1, 20, true), note(2, 30)]
  const tune: Tune = { title: 't', key: 'C', metre: [4, 4], notes, bars: [], chordChanges: [] }
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

describe('aggregateByStartChar with a real collapsed chord', () => {
  it('surfaces collapsedChord on the note reaching the render layer', () => {
    const tune = parseAbc(christmasAbc)[0]
    const lattice = mapTuneCandidates(tune, DG_STANDARD)
    const fingering = fingerWithConfidence(tune, lattice, () => 0)
    const cells = renderTab(fingering, DG_STANDARD)
    const map = aggregateByStartChar([{ tune, fingering, cells, lattice }])

    const collapsedNotes = tune.notes.filter((n) => n.collapsedChord)
    expect(collapsedNotes).toHaveLength(1)

    const surfaced = map.get(collapsedNotes[0].startChar)
    expect(surfaced?.note.collapsedChord).toBe(true)
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

describe('placeLabels', () => {
  it('places labels below each row bottom and skips startChars not in the map', () => {
    const anchors = [
      { startChar: 10, x: 5, y: 100 },
      { startChar: 20, x: 30, y: 90 },
      { startChar: 30, x: 2, y: 200 },
      { startChar: 40, x: 40, y: 210 },
    ]
    const map = new Map([
      [10, { text: 'D', pull: false }],
      [30, { text: 'A', pull: true }],
    ])
    const labels = placeLabels(anchors, map, 20)
    expect(labels).toEqual([
      { startChar: 10, x: 5, y: 120, text: 'D', pull: false },
      { startChar: 30, x: 2, y: 230, text: 'A', pull: true },
    ])
  })

  it('places labels above each row top when above is set', () => {
    const anchors = [
      { startChar: 10, x: 5, y: 100 },
      { startChar: 20, x: 30, y: 90 },
      { startChar: 30, x: 2, y: 200 },
      { startChar: 40, x: 40, y: 210 },
    ]
    const map = new Map([
      [10, { text: 'D', pull: false }],
      [30, { text: 'A', pull: true }],
    ])
    const labels = placeLabels(anchors, map, 20, true)
    expect(labels).toEqual([
      { startChar: 10, x: 5, y: 70, text: 'D', pull: false },
      { startChar: 30, x: 2, y: 180, text: 'A', pull: true },
    ])
  })
})
