import { describe, expect, it } from 'vitest'
import type { Candidate } from '../domain/instrument.ts'
import type { CostFn, Tune } from '../domain/notes.ts'
import { fingerWithConfidence } from './confidence.ts'

function fakeTune(noteCount: number): Tune {
  return {
    title: 't',
    key: 'C',
    metre: [4, 4],
    bars: [],
    notes: Array.from({ length: noteCount }, (_, i) => ({
      index: i,
      pitch: 60,
      writtenName: 'C',
      durationTicks: 180,
      startTicks: i * 180,
      bar: 1,
      startChar: i,
      rest: false,
      beatStrength: 1,
      phraseBoundaryBefore: false,
    })),
  }
}

const push = (buttonId: string): Candidate => ({ buttonId, direction: 'push' })
const pull = (buttonId: string): Candidate => ({ buttonId, direction: 'pull' })

describe('fingerWithConfidence', () => {
  it('marks a note low-confidence when its best alternative is an exact tie', () => {
    const lattice: Candidate[][] = [[push('A'), push('B')], [push('P')]]
    const cost: CostFn = () => 0
    const result = fingerWithConfidence(fakeTune(2), lattice, cost)
    expect(result.notes[0].chosen?.buttonId).toBe('A')
    expect(result.notes[0].costMargin).toBeCloseTo(0)
    expect(result.notes[0].confidence).toBeLessThan(1)
  })

  it('is confident about a note whose alternative is clearly worse', () => {
    const lattice: Candidate[][] = [[push('A'), pull('B')], [push('P')]]
    const cost: CostFn = (from, to) => (from && from.direction !== to.direction ? 0.3 : 0)
    const result = fingerWithConfidence(fakeTune(2), lattice, cost)
    expect(result.notes[0].chosen?.buttonId).toBe('A')
    expect(result.notes[0].costMargin).toBeCloseTo(0.3)
    expect(result.notes[0].confidence).toBe(1)
  })

  it('is fully confident about a note with only one candidate', () => {
    const lattice: Candidate[][] = [[push('A'), pull('B')], [push('P')]]
    const cost: CostFn = (from, to) => (from && from.direction !== to.direction ? 0.3 : 0)
    const result = fingerWithConfidence(fakeTune(2), lattice, cost)
    expect(result.notes[1].confidence).toBe(1)
    expect(result.notes[1].costMargin).toBe(Infinity)
  })

  it('is fully confident about a pinned note', () => {
    const lattice: Candidate[][] = [[push('A'), pull('B')], [push('P')]]
    const cost: CostFn = (from, to) => (from && from.direction !== to.direction ? 0.3 : 0)
    const pins = new Map<number, Candidate>([[0, pull('B')]])
    const result = fingerWithConfidence(fakeTune(2), lattice, cost, pins)
    expect(result.notes[0].chosen?.buttonId).toBe('B')
    expect(result.notes[0].confidence).toBe(1)
  })
})
