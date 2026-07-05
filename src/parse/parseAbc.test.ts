import { describe, expect, it } from 'vitest'
import { parseAbc } from './parseAbc.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

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

  it('flattens a bracket chord to its highest pitch and flags it', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nK:C\n[CEG] D |')
    expect(tune.notes[0].pitch).toBe(67)
    expect(tune.notes[0].flattenedChord).toBe(true)
    expect(tune.notes[1].flattenedChord).toBeUndefined()
  })

  it('records repeat structure', () => {
    const [tune] = parseAbc(moonAbc)
    const types = tune.bars.map((b) => b.type)
    expect(types).toContain('bar_left_repeat')
    expect(types).toContain('bar_right_repeat')
  })
})
