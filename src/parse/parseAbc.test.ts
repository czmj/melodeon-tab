import { describe, expect, it } from 'vitest'
import { parseAbc } from './parseAbc.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'
import oranAbc from '../fixtures/oran-na-cloiche.abc?raw'
import tansysAbc from '../fixtures/tansys-golowan.abc?raw'
import christmasAbc from '../fixtures/a-christmas.abc?raw'

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

  it('recognises a phrase boundary after a tie whose combined duration crosses the long-note threshold', () => {
    // Each fragment (A2) is a quaver on its own — too short to be a phrase boundary — but
    // tied together they total a half note, which should register as one.
    const [tune] = parseAbc('X:1\nL:1/8\nM:4/4\nK:C\nA2- A2 c4 |')
    expect(tune.notes[0].durationTicks).toBe(360)
    expect(tune.notes[1].phraseBoundaryBefore).toBe(true)
  })

  it('collapses a bracket chord to its highest pitch and flags it', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nK:C\n[CEG] D |')
    expect(tune.notes[0].pitch).toBe(67)
    expect(tune.notes[0].collapsedChord).toBe(true)
    expect(tune.notes[1].collapsedChord).toBeUndefined()
  })

  it('records repeat structure', () => {
    const [tune] = parseAbc(moonAbc)
    const types = tune.bars.map((b) => b.type)
    expect(types).toContain('bar_left_repeat')
    expect(types).toContain('bar_right_repeat')
  })

  it('ignores chord symbols as accompaniment hints, not pitches', () => {
    // oran-na-cloiche.abc carries "Am"/"C"/"Dm"/"G"/"Em" chord symbols throughout — none of
    // them should surface as a note or otherwise perturb the melody line.
    const [tune] = parseAbc(oranAbc)
    expect(tune.key).toBe('Amin')
    expect(tune.notes).toHaveLength(81)
    expect(tune.notes.slice(0, 4).map((n) => n.writtenName)).toEqual(['c', 'A', 'G', 'A'])
    expect(tune.notes.every((n) => n.rest || (n.pitch > 0 && Number.isInteger(n.pitch)))).toBe(true)
  })

  it('captures chord symbols as an accompaniment hint on the note they precede', () => {
    const [tune] = parseAbc(oranAbc)
    const symbols = tune.notes.map((n) => n.chordSymbol).filter((s): s is string => s !== undefined)
    expect(new Set(symbols)).toEqual(new Set(['Am', 'C', 'Dm', 'Em', 'G']))
    const firstAm = tune.notes.find((n) => n.chordSymbol)
    expect(firstAm?.chordSymbol).toBe('Am')
  })

  it('drops a text annotation that is not a real chord symbol', () => {
    // a-christmas.abc has a "to" annotation (abcjs tags it position:"default", like a chord);
    // parseChordSymbol rejects it, so it must not land in the model as a chord.
    const [tune] = parseAbc(christmasAbc)
    expect(tune.notes.some((n) => n.chordSymbol === 'to')).toBe(false)
    expect(tune.notes.every((n) => n.chordSymbol === undefined)).toBe(true)
  })

  it('known gap: 5/4 has no 3+2/2+3 grouping, so every main beat scores the same', () => {
    // tansys-golowan.abc is a 5/4 march — a metre felt as asymmetric sub-groups, which
    // basicBeatStrength does not model (roadmap step 6). Pinning today's real output so a
    // future grouping-aware fix breaks this deliberately instead of silently.
    const [tune] = parseAbc(tansysAbc)
    expect(tune.metre).toEqual([5, 4])
    expect(tune.notes.slice(0, 12).map((n) => n.beatStrength)).toEqual([
      1, 0.2, 0.6, 1, 0.6, 0.2, 0.6, 0.2, 0.6, 0.6, 0.2, 1,
    ])
  })
})
