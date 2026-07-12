import { describe, expect, it } from 'vitest'
import {
  analyseMatch,
  chordLabel,
  deriveChords,
  matchScore,
  parseChordSymbol,
} from './chord.ts'
import type { Chord } from './chord.ts'
import { DG_STANDARD } from './instrument.ts'

describe('parseChordSymbol', () => {
  it('reads a plain major triad symbol', () => {
    expect(parseChordSymbol('D')).toEqual({ root: 2, quality: 'maj' })
    expect(parseChordSymbol('G')).toEqual({ root: 7, quality: 'maj' })
  })

  it('reads minor symbols', () => {
    expect(parseChordSymbol('Gm')).toEqual({ root: 7, quality: 'min' })
    expect(parseChordSymbol('Bm')).toEqual({ root: 11, quality: 'min' })
    expect(parseChordSymbol('F#m')).toEqual({ root: 6, quality: 'min' })
  })

  it('reads accidentals in the root', () => {
    expect(parseChordSymbol('Bb')).toEqual({ root: 10, quality: 'maj' })
    expect(parseChordSymbol('C#m')).toEqual({ root: 1, quality: 'min' })
  })

  it('reduces richer symbols to their triad core', () => {
    expect(parseChordSymbol('A7')).toEqual({ root: 9, quality: 'maj' })
    expect(parseChordSymbol('Cmaj7')).toEqual({ root: 0, quality: 'maj' })
    expect(parseChordSymbol('Em7')).toEqual({ root: 4, quality: 'min' })
    expect(parseChordSymbol('Dsus4')).toEqual({ root: 2, quality: 'maj' })
    expect(parseChordSymbol('Edim')).toEqual({ root: 4, quality: 'min' })
  })

  it('ignores a slash bass note', () => {
    expect(parseChordSymbol('D/F#')).toEqual({ root: 2, quality: 'maj' })
  })

  it('returns null for an unparseable symbol', () => {
    expect(parseChordSymbol('H')).toBeNull()
    expect(parseChordSymbol('')).toBeNull()
  })

  it('rejects text annotations that merely start with a note letter', () => {
    for (const junk of ['Fine', 'D.C.', 'Coda', 'Andante', 'Gently', 'Bright', 'D.S.', 'Faster']) {
      expect(parseChordSymbol(junk)).toBeNull()
    }
  })

  it('still accepts the full range of real chord suffixes', () => {
    for (const ok of ['C', 'Am', 'Gmaj7', 'F#m7', 'Bbsus4', 'Aadd9', 'Edim', 'Caug', 'D/F#', 'A7']) {
      expect(parseChordSymbol(ok)).not.toBeNull()
    }
  })
})

describe('deriveChords', () => {
  it('labels a full major triad uniquely', () => {
    expect(deriveChords([60, 64, 67])).toEqual([{ root: 0, quality: 'maj' }])
  })

  it('labels a full minor triad uniquely', () => {
    expect(deriveChords([57, 60, 64])).toEqual([{ root: 9, quality: 'min' }])
  })

  it('returns both qualities for a thirdless root+fifth dyad', () => {
    expect(deriveChords([62, 69])).toEqual([
      { root: 2, quality: 'maj' },
      { root: 2, quality: 'min' },
    ])
  })

  it('returns no chord for a bare single note', () => {
    expect(deriveChords([62])).toEqual([])
  })

  it('derives the chart labels for every DG_STANDARD chord button', () => {
    const label = (pitches: number[]) => deriveChords(pitches).map(chordLabel)
    const chords = DG_STANDARD.bass.buttons.filter((b) => b.role === 'chord')
    const byId = (id: string) => chords.find((b) => b.id === id)!
    expect(label(byId('chord1').push)).toEqual(['D'])
    expect(label(byId('chord1').pull)).toEqual(['A'])
    expect(label(byId('chord2').push)).toEqual(['B'])
    expect(label(byId('chord2').pull)).toEqual(['Em'])
    expect(label(byId('chord3').push)).toEqual(['G'])
    expect(label(byId('chord3').pull)).toEqual(['D'])
    expect(label(byId('chord4').push)).toEqual(['C'])
    expect(label(byId('chord4').pull)).toEqual(['C'])
  })
})

describe('chordLabel', () => {
  it('spells majors bare and minors with a trailing m', () => {
    expect(chordLabel({ root: 2, quality: 'maj' })).toBe('D')
    expect(chordLabel({ root: 4, quality: 'min' })).toBe('Em')
  })
})

describe('matchScore', () => {
  const dMaj: Chord = { root: 2, quality: 'maj' }

  it('scores an exact triad match above a bare dyad above the root alone', () => {
    const triad = matchScore([62, 66, 69], dMaj)
    const dyad = matchScore([62, 69], dMaj)
    const rootOnly = matchScore([62], dMaj)
    expect(triad).toBeGreaterThan(dyad)
    expect(dyad).toBeGreaterThan(rootOnly)
  })

  it('penalises a clashing third', () => {
    expect(analyseMatch([60, 63, 67], { root: 0, quality: 'maj' }).clashingThird).toBe(true)
    expect(matchScore([60, 63, 67], { root: 0, quality: 'maj' })).toBeLessThan(
      matchScore([60, 64, 67], { root: 0, quality: 'maj' }),
    )
  })

  it('scores a C major chord as a partial match for A minor (the relative-minor hack)', () => {
    expect(matchScore([60, 64, 67], { root: 9, quality: 'min' })).toBeGreaterThan(0)
  })

  it('scores a bass root above a bass fifth', () => {
    expect(matchScore([62], dMaj)).toBeGreaterThan(matchScore([69], dMaj))
  })
})
