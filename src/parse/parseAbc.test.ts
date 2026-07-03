import { describe, expect, it } from 'vitest'
import { parseAbc } from './parseAbc.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

describe('parseAbc', () => {
  it('extracts header, notes and sounding pitch from a D major jig', () => {
    const [tune] = parseAbc(moonAbc)
    expect(tune.title).toBe('The Moon And The Seven Stars')
    expect(tune.key).toBe('Dmaj')
    expect(tune.metre).toBe('6/8')
    expect(tune.notes.length).toBeGreaterThan(0)

    const first = tune.notes[0]
    expect(first.writtenNames).toEqual(['d'])
    expect(first.midiPitches).toEqual([74])
    expect(first.durationWholeNotes).toBeCloseTo(0.25)
  })

  it('applies key signature to sounding pitch (written F sounds F#)', () => {
    const [tune] = parseAbc(moonAbc)
    const f = tune.notes.find((n) => n.writtenNames[0] === 'F')
    expect(f?.midiPitches).toEqual([66])
  })

  it('resolves explicit accidentals (^A sounds A#)', () => {
    const [tune] = parseAbc(jiggeryAbc)
    const sharpA = tune.notes.find((n) => n.writtenNames[0] === '^A')
    expect(sharpA?.midiPitches).toEqual([70])
  })

  it('merges a tie into one note with combined duration and the sounding pitch', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nM:4/4\nK:C\nA2- A2 c4 |')
    expect(tune.notes.map((n) => n.writtenNames.join(''))).toEqual(['A', 'c'])
    const a = tune.notes[0]
    expect(a.durationWholeNotes).toBeCloseTo(0.5)
    expect(a.midiPitches).toEqual([69])
  })

  it('records repeat structure', () => {
    const [tune] = parseAbc(moonAbc)
    const types = tune.bars.map((b) => b.type)
    expect(types).toContain('bar_left_repeat')
    expect(types).toContain('bar_right_repeat')
  })
})
