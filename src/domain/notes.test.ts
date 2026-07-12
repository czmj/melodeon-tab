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

  it('known gap: treats every beat in 5/4 as equally strong, with no 3+2/2+3 grouping', () => {
    // basicBeatStrength has no asymmetric-metre grouping (roadmap step 6), so every
    // quarter-note beat in a bar scores the same 0.6 "main beat" — the beat starting the
    // second sub-group of a 3+2 (or 2+3) bar doesn't read any stronger than one that's
    // merely continuing the first. src/fixtures/tansys-golowan.abc (a 5/4 march) is the
    // reproduction case; this test pins today's behaviour so a future grouping-aware fix
    // fails it deliberately, rather than silently changing fingering with nothing to catch it.
    const beat = (ticks: number) => basicBeatStrength(ticks, [5, 4])
    expect([0, 180, 360, 540, 720].map(beat)).toEqual([1, 0.6, 0.6, 0.6, 0.6])
  })
})
