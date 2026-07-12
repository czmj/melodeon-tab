import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import { mapTuneCandidates } from '../engine/candidates.ts'
import { computeFingering } from '../engine/fingering.ts'
import { fingerWithConfidence } from '../engine/confidence.ts'
import { makeCostFn } from '../engine/cost.ts'
import { renderTab } from './tab.ts'
import type { CostFn, Tune } from '../domain/notes.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'
import bansheeAbc from '../fixtures/the-banshee.abc?raw'

function tab(abc: string) {
  const tune = parseAbc(abc)[0]
  const fingering = computeFingering(tune, mapTuneCandidates(tune, DG_STANDARD), makeCostFn(DG_STANDARD))
  return { tune, cells: renderTab(fingering, DG_STANDARD) }
}

describe('renderTab', () => {
  it('renders an inside-row push: bare number, no underline', () => {
    const { cells } = tab('X:1\nL:1/8\nK:D\nD|')
    expect(cells[0]).toMatchObject({
      text: '3',
      pull: false,
      playable: true,
    })
  })

  it('renders an outside-row pull: parenthesised number, underlined', () => {
    const { cells } = tab('X:1\nL:1/8\nK:C\nc|')
    expect(cells[0]).toMatchObject({
      text: '(4)',
      pull: true,
      playable: true,
    })
  })

  it('renders a rest as a dash', () => {
    const { cells } = tab('X:1\nL:1/8\nK:D\nz|')
    expect(cells[0]).toMatchObject({ text: '-', rest: true, playable: false })
  })

  it('renders an unplayable note as a question mark', () => {
    const { tune, cells } = tab(jiggeryAbc)
    const i = tune.notes.findIndex((n) => n.writtenName === '^A')
    expect(cells[i]).toMatchObject({ text: '?', playable: false })
  })

  it('produces one cell per note; playable cells carry a bare or parenthesised button number', () => {
    const { tune, cells } = tab(moonAbc)
    expect(cells.length).toBe(tune.notes.length)
    for (const cell of cells) {
      if (cell.playable) {
        expect(cell.text).toMatch(/^\(?\d+\)?$/)
      }
    }
  })

  it('produces one cell per note for The Banshee end to end', () => {
    const { tune, cells } = tab(bansheeAbc)
    expect(cells.length).toBe(tune.notes.length)
    expect(tune.notes.length).toBe(116)
    for (const cell of cells) {
      if (cell.playable) {
        expect(cell.text).toMatch(/^\(?\d+\)?$/)
      }
    }
  })

  it('flags a genuine near-tie as low-confidence through the real fingerWithConfidence path', () => {
    // computeFingering alone always sets confidence: 1 — the real confidence computation
    // only happens in fingerWithConfidence, which is what App.tsx actually calls. This
    // chains that real path into renderTab, rather than the stubbed one every other test uses.
    const tune: Tune = {
      title: 't',
      key: 'C',
      metre: [4, 4],
      bars: [],
      chordChanges: [],
      notes: [
        {
          index: 0,
          pitch: 62, // D4 — has three real candidates on DG_STANDARD (d3-push, g1-pull, g2-push)
          writtenName: 'D',
          durationTicks: 180,
          startTicks: 0,
          bar: 1,
          startChar: 0,
          rest: false,
          beatStrength: 1,
          phraseBoundaryBefore: false,
        },
      ],
    }
    const lattice = mapTuneCandidates(tune, DG_STANDARD)
    expect(lattice[0].length).toBeGreaterThan(1)
    const flatCost: CostFn = () => 0
    const fingering = fingerWithConfidence(tune, lattice, flatCost)
    const cells = renderTab(fingering, DG_STANDARD)
    expect(cells[0].lowConfidence).toBe(true)
  })
})
