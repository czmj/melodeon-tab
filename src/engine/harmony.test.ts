import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import { chordLabel } from '../domain/chord.ts'
import { analyseHarmony, preferredDirection } from './harmony.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import oranAbc from '../fixtures/oran-na-cloiche.abc?raw'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import tansysAbc from '../fixtures/tansys-golowan.abc?raw'

describe('preferredDirection', () => {
  it('locks a direction where the box can only realise the chord one way', () => {
    expect(preferredDirection(DG_STANDARD, { root: 7, quality: 'maj' })).toBe('push') // G push-only
    expect(preferredDirection(DG_STANDARD, { root: 9, quality: 'maj' })).toBe('pull') // A pull-only
  })

  it('prefers pull for Am, the only side with an A bass', () => {
    expect(preferredDirection(DG_STANDARD, { root: 9, quality: 'min' })).toBe('pull')
  })

  it('imposes no preference for a bidirectional chord', () => {
    expect(preferredDirection(DG_STANDARD, { root: 2, quality: 'maj' })).toBeNull() // D both ways
    expect(preferredDirection(DG_STANDARD, { root: 0, quality: 'maj' })).toBeNull() // C both ways
  })
})

describe('analyseHarmony', () => {
  it('marks a written chord with its source and preferred direction', () => {
    const tune = parseAbc(oranAbc)[0]
    const harmony = analyseHarmony(tune, DG_STANDARD)
    const amIndex = harmony.findIndex(
      (h) => h.target?.root === 9 && h.target?.quality === 'min',
    )
    expect(harmony[amIndex]).toEqual({
      target: { root: 9, quality: 'min' },
      source: 'written',
      preferredDirection: 'pull',
      label: 'Am',
    })
  })

  it('marks symbol-less tunes as fallback-sourced', () => {
    const tune = parseAbc(moonAbc)[0]
    const harmony = analyseHarmony(tune, DG_STANDARD)
    expect(harmony.every((h) => h.source === 'fallback' || h.source === null)).toBe(true)
    expect(harmony.some((h) => h.source === 'fallback')).toBe(true)
  })

  it('key-aware fallback prefers the tonic over the relative minor', () => {
    // Tansys Golowan is in G major with no written chords; without key awareness the fallback
    // picked Em (the relative minor, shares G+B with the tonic) for most bars.
    const tune = parseAbc(tansysAbc)[0]
    const harmony = analyseHarmony(tune, DG_STANDARD)
    const counts = new Map<string, number>()
    for (const h of harmony) {
      if (!h.target) continue
      const label = chordLabel(h.target)
      counts.set(label, (counts.get(label) ?? 0) + 1)
    }
    const topChord = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    expect(topChord).toBe('G')
    expect(counts.get('Em') ?? 0).toBe(0)
    // only diatonic G-major chords appear (I/IV/V/vi)
    expect([...counts.keys()].every((l) => ['G', 'C', 'D', 'Em'].includes(l))).toBe(true)
  })
})
