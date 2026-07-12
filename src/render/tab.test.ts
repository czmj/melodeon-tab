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
})
