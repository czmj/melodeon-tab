import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import { mapTuneCandidates } from '../engine/candidates.ts'
import { computeFingering } from '../engine/fingering.ts'
import { makeCostFn } from '../engine/cost.ts'
import { renderTab } from './tab.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

function tab(abc: string) {
  const tune = parseAbc(abc)[0]
  const fingering = computeFingering(tune, mapTuneCandidates(tune, DG_STANDARD), makeCostFn(DG_STANDARD))
  return { tune, cells: renderTab(fingering, DG_STANDARD) }
}

describe('renderTab', () => {
  it('renders a D-row push as a bare button number', () => {
    const { cells } = tab('X:1\nL:1/8\nK:D\nD|')
    expect(cells[0].token).toBe('3')
  })

  it("marks the G row with a prime and pull with an underscore", () => {
    const { cells } = tab('X:1\nL:1/8\nK:C\nc|')
    expect(cells[0].token).toBe("4'_")
  })

  it('renders a rest as a dash', () => {
    const { cells } = tab('X:1\nL:1/8\nK:D\nz|')
    expect(cells[0].token).toBe('-')
    expect(cells[0].rest).toBe(true)
  })

  it('renders an unplayable note as a question mark', () => {
    const { tune, cells } = tab(jiggeryAbc)
    const i = tune.notes.findIndex((n) => n.writtenName === '^A')
    expect(cells[i].token).toBe('?')
    expect(cells[i].playable).toBe(false)
  })

  it('produces one cell per note, all well-formed', () => {
    const { tune, cells } = tab(moonAbc)
    expect(cells.length).toBe(tune.notes.length)
    for (const cell of cells) {
      expect(cell.token).toMatch(/^(\d+'?_?|-|\?)$/)
    }
  })
})
