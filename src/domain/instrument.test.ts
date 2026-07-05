import { describe, expect, it } from 'vitest'
import { DG_STANDARD, candidatesForPitch, resolveCandidate } from './instrument.ts'

describe('DG_STANDARD', () => {
  it('has 21 treble buttons and an empty bass', () => {
    expect(DG_STANDARD.treble.buttons).toHaveLength(21)
    expect(DG_STANDARD.bass.buttons).toHaveLength(0)
  })

  it('finds every candidate that sounds D4 = 62 (a cross-row reversal)', () => {
    expect(candidatesForPitch(DG_STANDARD, 62)).toEqual([
      { buttonId: 'd3', direction: 'push' },
      { buttonId: 'g1', direction: 'pull' },
      { buttonId: 'g2', direction: 'push' },
    ])
  })

  it('returns an empty array for a diatonic gap (C natural = 60)', () => {
    expect(candidatesForPitch(DG_STANDARD, 60)).toEqual([])
  })

  it('resolves a candidate to its button, row, position and sounding pitch', () => {
    const r = resolveCandidate(DG_STANDARD, { buttonId: 'd3', direction: 'push' })
    expect(r.row).toBe(0)
    expect(r.position).toBe(3)
    expect(r.pitch).toBe(62)
  })
})
