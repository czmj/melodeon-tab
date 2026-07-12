import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import type { Direction } from '../domain/instrument.ts'
import type { ChordChange, FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import { parseChordSymbol } from '../domain/chord.ts'
import { mapTuneCandidates } from './candidates.ts'
import { computeFingering } from './fingering.ts'
import { makeCostFn } from './cost.ts'
import { analyseHarmony } from './harmony.ts'
import { accompanimentDisplay, suggestAccompaniment } from './accompaniment.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import jerichoAbc from '../fixtures/jericho.abc?raw'
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

function tuneOf(notes: NoteEvent[], chordChanges: ChordChange[] = []): Tune {
  return { title: 't', key: 'D', metre: [4, 4], notes, bars: [], chordChanges }
}

function chg(startChar: number, startTicks: number, symbol: string): ChordChange {
  return { startChar, startTicks, chord: parseChordSymbol(symbol)! }
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

  it('realises a chord the box lacks via the relative-major hack, not a coincidental root match', () => {
    const tune = parseAbc(oranAbc)[0]
    const fingering = computeFingering(
      tune,
      mapTuneCandidates(tune, DG_STANDARD),
      makeCostFn(DG_STANDARD),
    )
    const sugg = suggestAccompaniment(tune, fingering, DG_STANDARD)
    const harmony = analyseHarmony(tune, DG_STANDARD)
    const amIndex = harmony.findIndex(
      (h) => h.target?.root === 9 && h.target?.quality === 'min',
    )
    const am = sugg[amIndex]
    expect(am.target).toEqual({ root: 9, quality: 'min' })
    expect(am.chordLabel).toBe('C')
    expect(am.bassLabel).toBe('A')
  })

  it('holds a written-chord span on its preferred direction so the bass does not drop (chord-first)', () => {
    const tune = parseAbc(oranAbc)[0]
    const lattice = mapTuneCandidates(tune, DG_STANDARD)
    const cost = makeCostFn(DG_STANDARD)
    const harmony = analyseHarmony(tune, DG_STANDARD)

    let end = 0
    while (
      end < harmony.length &&
      harmony[end].target?.root === 9 &&
      harmony[end].target?.quality === 'min'
    ) {
      end += 1
    }
    const amSpan = [...Array(end).keys()]
    expect(amSpan.length).toBeGreaterThan(3)

    const countA = (s: ReturnType<typeof suggestAccompaniment>) =>
      amSpan.filter((i) => s[i].bassLabel === 'A').length

    const chordFirst = suggestAccompaniment(
      tune,
      computeFingering(tune, lattice, cost, new Map(), harmony),
      DG_STANDARD,
    )
    const melodyFirst = suggestAccompaniment(
      tune,
      computeFingering(tune, lattice, cost),
      DG_STANDARD,
    )

    // Never a wrong bass in the span — every sounding note is the A bass, the rest silent.
    expect(
      amSpan.every((i) => chordFirst[i].bassLabel === 'A' || chordFirst[i].bassLabel === null),
    ).toBe(true)
    // Chord-first pulls more of the run onto the A bass than melody-first leaves sounding.
    expect(countA(chordFirst)).toBeGreaterThan(countA(melodyFirst))
  })

  it('takes the written chord symbol as the harmony target, carried forward until the next', () => {
    const tune = tuneOf(
      [
        note({ index: 0, startChar: 0, startTicks: 0 }),
        note({ index: 1, startChar: 2, startTicks: 180 }),
        note({ index: 2, startChar: 4, startTicks: 360 }),
      ],
      [chg(0, 0, 'D'), chg(4, 360, 'G')],
    )
    const fingering = fingeringOf(tune, ['push', 'push', 'push'])
    const sugg = suggestAccompaniment(tune, fingering, DG_STANDARD)
    expect(sugg[0].target).toEqual({ root: 2, quality: 'maj' })
    expect(sugg[1].target).toEqual({ root: 2, quality: 'maj' })
    expect(sugg[2].target).toEqual({ root: 7, quality: 'maj' })
  })

  it('plays the exact chord and root bass when the box has them in the melody direction', () => {
    const tune = tuneOf([note({ index: 0 })], [chg(0, 0, 'D')])
    const sugg = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(sugg[0].chordLabel).toBe('D')
    expect(sugg[0].bassLabel).toBe('D')
  })

  it('reaches A major only on pull; on push it can only approximate it (the A-pull binding)', () => {
    const tune = tuneOf([note({ index: 0 })], [chg(0, 0, 'A')])
    const pull = suggestAccompaniment(tune, fingeringOf(tune, ['pull']), DG_STANDARD)
    expect(pull[0].chordLabel).toBe('A')

    const push = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(push[0].chordLabel).not.toBe('A')
  })

  it('reaches G major only on push; on pull it can only approximate it (the G-push binding)', () => {
    const tune = tuneOf([note({ index: 0 })], [chg(0, 0, 'G')])
    const push = suggestAccompaniment(tune, fingeringOf(tune, ['push']), DG_STANDARD)
    expect(push[0].chordLabel).toBe('G')

    const pull = suggestAccompaniment(tune, fingeringOf(tune, ['pull']), DG_STANDARD)
    expect(pull[0].chordLabel).not.toBe('G')
  })

  it('suggests nothing for a note the melody could not place (no bellows direction)', () => {
    const tune = tuneOf([note({ index: 0 })], [chg(0, 0, 'D')])
    const sugg = suggestAccompaniment(tune, fingeringOf(tune, [null]), DG_STANDARD)
    expect(sugg[0]).toMatchObject({ direction: null, bass: null, chord: null, chordLabel: null })
  })

  it('falls back to a melody-implied target when the tune carries no chord symbols', () => {
    const tune = parseAbc(moonAbc)[0]
    expect(tune.chordChanges).toHaveLength(0)
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

describe('accompanimentDisplay', () => {
  function display(abc: string) {
    const tune = parseAbc(abc)[0]
    const lattice = mapTuneCandidates(tune, DG_STANDARD)
    const harmony = analyseHarmony(tune, DG_STANDARD)
    const fingering = computeFingering(tune, lattice, makeCostFn(DG_STANDARD), new Map(), harmony)
    return { tune, tokens: accompanimentDisplay(tune, fingering, DG_STANDARD, harmony) }
  }

  it('places a chord change that lands on a tie at its own position, not the held note', () => {
    const { tune, tokens } = display(jerichoAbc)
    const noteChars = new Set(tune.notes.map((n) => n.startChar))
    const offNote = tokens.chordNames.find((t) => t.text === 'A7' && !noteChars.has(t.startChar))
    expect(offNote).toBeDefined()
  })

  it('shows the written symbol literally (A7, not A) as the chord name', () => {
    const { tokens } = display(jerichoAbc)
    expect(tokens.chordNames.some((t) => t.text === 'A7')).toBe(true)
    expect(tokens.chordNames.some((t) => t.text === 'Dm')).toBe(true)
  })

  it('names the intended chord (Am) while realising it as an A bass and c chord', () => {
    const { tokens } = display(oranAbc)
    expect(tokens.chordNames.some((t) => t.text === 'Am')).toBe(true)
    expect(tokens.bass.some((t) => t.text === 'A')).toBe(true)
    expect(tokens.chord.some((t) => t.text === 'c')).toBe(true)
  })

  it('still names chords for a symbol-less tune, from the fallback', () => {
    const { tokens } = display(moonAbc)
    expect(tokens.chordNames.length).toBeGreaterThan(0)
  })

  it('reprints the chord at the start of each bar even when it carries over', () => {
    const { tune, tokens } = display('X:1\nL:1/4\nM:C\nK:Dm\n"Dm"DDDD|DDDD|DDDD|')
    const dm = tokens.chordNames.filter((t) => t.text === 'Dm')
    // one Dm at each of the three bar starts, though the chord never changes
    expect(dm).toHaveLength(3)
    const barStartChars = tune.notes
      .filter((n, i) => i === 0 || tune.notes[i - 1].bar !== n.bar)
      .map((n) => n.startChar)
    expect(dm.map((t) => t.startChar)).toEqual(barStartChars)
  })
})
