import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import type { Direction } from '../domain/instrument.ts'
import type { FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import { mapTuneCandidates } from './candidates.ts'
import { computeFingering } from './fingering.ts'
import { makeCostFn } from './cost.ts'
import { suggestAccompaniment } from './accompaniment.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import oranAbc from '../fixtures/oran-na-cloiche.abc?raw'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'

function note(overrides: Partial<NoteEvent> & { index: number }): NoteEvent {
  return {
    pitch: 62,
    writtenName: 'D',
    durationTicks: 180,
    startTicks: 0,
    bar: 1,
    startChar: 0,
    rest: false,
    beatStrength: 1,
    phraseBoundaryBefore: false,
    ...overrides,
  }
}

function tuneOf(notes: NoteEvent[]): Tune {
  return { title: 't', key: 'D', metre: [4, 4], notes, bars: [] }
}

function fingeringOf(tune: Tune, directions: (Direction | null)[]): FingeringResult {
  return {
    tune,
    notes: directions.map((d, i) => ({
      noteIndex: i,
      chosen: d ? { buttonId: 'placeholder', direction: d } : null,
      alternatives: [],
      pinned: false,
      confidence: 1,
      costMargin: 0,
    })),
    totalCost: 0,
  }
}

describe('suggestAccompaniment', () => {
  it('produces one suggestion per note', () => {
    const tune = parseAbc(oranAbc)[0]
    const fingering = computeFingering(
      tune,
      mapTuneCandidates(tune, DG_STANDARD),
      makeCostFn(DG_STANDARD),
    )
    expect(suggestAccompaniment(tune, fingering, DG_STANDARD)).toHaveLength(tune.notes.length)
  })

  it('takes the written chord symbol as the harmony target, carried forward until the next', () => {
    const tune = tuneOf([
      note({ index: 0, startChar: 0, chordSymbol: 'D' }),
      note({ index: 1, startChar: 2 }),
      note({ index: 2, startChar: 4, chordSymbol: 'G' }),
    ])
    const fingering = fingeringOf(tune, ['push', 'push', 'push'])
    const sugg = suggestAccompaniment(tune, fingering, DG_STANDARD)
    expect(sugg[0].target).toEqual({ root: 2, quality: 'maj' })
    expect(sugg[1].target).toEqual({ root: 2, quality: 'maj' })
    expect(sugg[2].target).toEqual({ root: 7, quality: 'maj' })
  })

  it('plays the exact chord and root bass when the box has them in the melody direction', () => {
    const tune = tuneOf([note({ index: 0, chordSymbol: 'D' })])
    const sugg = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(sugg[0].chordLabel).toBe('D')
    expect(sugg[0].bassLabel).toBe('D')
  })

  it('reaches A major only on pull; on push it can only approximate it (the A-pull binding)', () => {
    const tune = tuneOf([note({ index: 0, chordSymbol: 'A' })])
    const pull = suggestAccompaniment(tune, fingeringOf(tune, ['pull']), DG_STANDARD)
    expect(pull[0].chordLabel).toBe('A')

    const push = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(push[0].chordLabel).not.toBe('A')
  })

  it('reaches G major only on push; on pull it can only approximate it (the G-push binding)', () => {
    const tune = tuneOf([note({ index: 0, chordSymbol: 'G' })])
    const push = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(push[0].chordLabel).toBe('G')

    const pull = suggestAccompaniment(tune, fingeringOf(tune, ['pull']), DG_STANDARD)
    expect(pull[0].chordLabel).not.toBe('G')
  })

  it('suggests nothing for a note the melody could not place (no bellows direction)', () => {
    const tune = tuneOf([note({ index: 0, chordSymbol: 'D' })])
    const sugg = suggestAccompaniment(tune, fingeringOf(tune, [null]), DG_STANDARD)
    expect(sugg[0]).toMatchObject({ direction: null, bass: null, chord: null, chordLabel: null })
  })

  it('falls back to a melody-implied target when the tune carries no chord symbols', () => {
    const tune = parseAbc(moonAbc)[0]
    expect(tune.notes.every((n) => n.chordSymbol === undefined)).toBe(true)
    const fingering = computeFingering(
      tune,
      mapTuneCandidates(tune, DG_STANDARD),
      makeCostFn(DG_STANDARD),
    )
    const sugg = suggestAccompaniment(tune, fingering, DG_STANDARD)
    expect(sugg.some((s) => s.target !== null)).toBe(true)
    expect(sugg.some((s) => s.chordLabel !== null)).toBe(true)
  })
})
