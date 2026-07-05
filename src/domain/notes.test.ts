import { describe, expect, it } from 'vitest'
import { PPWN, basicBeatStrength, wholeNotesToTicks } from './notes.ts'

describe('wholeNotesToTicks', () => {
  it('converts common durations to integer ticks', () => {
    expect(PPWN).toBe(720)
    expect(wholeNotesToTicks(0.125)).toBe(90)
    expect(wholeNotesToTicks(0.25)).toBe(180)
    expect(wholeNotesToTicks(1 / 12)).toBe(60)
  })
})

describe('basicBeatStrength', () => {
  it('scores 4/4 positions: downbeat, on-beat, offbeat', () => {
    expect(basicBeatStrength(0, [4, 4])).toBe(1)
    expect(basicBeatStrength(180, [4, 4])).toBe(0.6)
    expect(basicBeatStrength(90, [4, 4])).toBe(0.2)
  })

  it('scores 6/8 by compound main beats (positions 0 and 3 quavers)', () => {
    expect(basicBeatStrength(0, [6, 8])).toBe(1)
    expect(basicBeatStrength(270, [6, 8])).toBe(0.6)
    expect(basicBeatStrength(90, [6, 8])).toBe(0.2)
  })
})
