import { describe, expect, it } from 'vitest'
import { collapseBassLine, renderBassLine } from './bassLine.ts'
import type { BassCell } from './bassLine.ts'
import type { BassSuggestion } from '../engine/accompaniment.ts'
import { DG_STANDARD } from '../domain/instrument.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import { mapTuneCandidates } from '../engine/candidates.ts'
import { computeFingering } from '../engine/fingering.ts'
import { makeCostFn } from '../engine/cost.ts'
import { suggestAccompaniment } from '../engine/accompaniment.ts'
import oranAbc from '../fixtures/oran-na-cloiche.abc?raw'

function suggestion(overrides: Partial<BassSuggestion> & { noteIndex: number }): BassSuggestion {
  return {
    direction: null,
    target: null,
    bass: null,
    chord: null,
    bassLabel: null,
    chordLabel: null,
    ...overrides,
  }
}

describe('renderBassLine', () => {
  it('renders bass in CAPS and chord in lowercase, underlining on pull', () => {
    const [cell] = renderBassLine([
      suggestion({ noteIndex: 0, direction: 'pull', bassLabel: 'D', chordLabel: 'Em' }),
    ])
    expect(cell).toEqual({ noteIndex: 0, pull: true, bassText: 'D', chordText: 'em' })
  })

  it('does not underline a push strike', () => {
    const [cell] = renderBassLine([
      suggestion({ noteIndex: 0, direction: 'push', bassLabel: 'G', chordLabel: 'G' }),
    ])
    expect(cell).toMatchObject({ pull: false, bassText: 'G', chordText: 'g' })
  })

  it('leaves an empty cell where the melody gave no strike', () => {
    const [cell] = renderBassLine([suggestion({ noteIndex: 0 })])
    expect(cell).toEqual({ noteIndex: 0, pull: null, bassText: null, chordText: null })
  })

  it('is a pure view: one cell per suggestion, end to end', () => {
    const tune = parseAbc(oranAbc)[0]
    const fingering = computeFingering(
      tune,
      mapTuneCandidates(tune, DG_STANDARD),
      makeCostFn(DG_STANDARD),
    )
    const cells = renderBassLine(suggestAccompaniment(tune, fingering, DG_STANDARD))
    expect(cells).toHaveLength(tune.notes.length)
    expect(cells.some((c) => c.bassText !== null)).toBe(true)
    expect(cells.some((c) => c.chordText !== null)).toBe(true)
    for (const c of cells) {
      if (c.bassText !== null) expect(c.bassText).toBe(c.bassText.toUpperCase())
      if (c.chordText !== null) expect(c.chordText).toBe(c.chordText.toLowerCase())
    }
  })
})

describe('collapseBassLine', () => {
  const cell = (o: Partial<BassCell> & { noteIndex: number }): BassCell => ({
    pull: false,
    bassText: null,
    chordText: null,
    ...o,
  })

  it('emits a bass and chord token only where each stream changes, independently', () => {
    const { bass, chord } = collapseBassLine([
      cell({ noteIndex: 0, bassText: 'D', chordText: 'd' }),
      cell({ noteIndex: 1, bassText: 'A', chordText: 'd' }),
      cell({ noteIndex: 2, bassText: 'A', chordText: 'g' }),
    ])
    expect(bass).toEqual([
      { noteIndex: 0, text: 'D', pull: false },
      { noteIndex: 1, text: 'A', pull: false },
    ])
    expect(chord).toEqual([
      { noteIndex: 0, text: 'd', pull: false },
      { noteIndex: 2, text: 'g', pull: false },
    ])
  })

  it('treats a bellows-direction flip on the same note as a change', () => {
    const { bass } = collapseBassLine([
      cell({ noteIndex: 0, bassText: 'D', pull: false }),
      cell({ noteIndex: 1, bassText: 'D', pull: true }),
    ])
    expect(bass).toEqual([
      { noteIndex: 0, text: 'D', pull: false },
      { noteIndex: 1, text: 'D', pull: true },
    ])
  })

  it('skips empty cells without re-triggering the carried value afterwards', () => {
    const { chord } = collapseBassLine([
      cell({ noteIndex: 0, chordText: 'd', pull: false }),
      cell({ noteIndex: 1, pull: null }),
      cell({ noteIndex: 2, chordText: 'd', pull: false }),
    ])
    expect(chord).toEqual([{ noteIndex: 0, text: 'd', pull: false }])
  })
})
