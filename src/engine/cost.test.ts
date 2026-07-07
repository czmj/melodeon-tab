import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import type { Candidate } from '../domain/instrument.ts'
import type { CostContext } from '../domain/notes.ts'
import { DEFAULT_WEIGHTS, makeCostFn } from './cost.ts'

const ctx = (beatStrength: number, sameDirectionRun = 0): CostContext => ({
  metre: [4, 4],
  beatStrength,
  phraseBoundaryBefore: false,
  sameDirectionRun,
})

const d3push: Candidate = { buttonId: 'd3', direction: 'push' }
const d3pull: Candidate = { buttonId: 'd3', direction: 'pull' }
const d5push: Candidate = { buttonId: 'd5', direction: 'push' }
const g3push: Candidate = { buttonId: 'g3', direction: 'push' }
const g1pull: Candidate = { buttonId: 'g1', direction: 'pull' }

describe('makeCostFn', () => {
  const cost = makeCostFn(DG_STANDARD, DEFAULT_WEIGHTS)

  it('is free to enter from no previous note', () => {
    expect(cost(null, d3push, ctx(1))).toBe(0)
  })

  it('charges a cheap reversal onto a strong beat (downbeat)', () => {
    expect(cost(d3push, d3pull, ctx(1))).toBeCloseTo(0.25)
  })

  it('charges an intermediate reversal onto a main beat', () => {
    expect(cost(d3push, d3pull, ctx(0.6))).toBeCloseTo(0.75)
  })

  it('charges a full reversal onto a weak off-beat', () => {
    expect(cost(d3push, d3pull, ctx(0.2))).toBeCloseTo(1.25)
  })

  it('charges the row-change weight regardless of beat', () => {
    expect(cost(d3push, g3push, ctx(0.2))).toBeCloseTo(0.5)
  })

  it('adds a beat-scaled reversal and a row change for a cross-row reversal onto a downbeat', () => {
    expect(cost(d3push, g1pull, ctx(1))).toBeCloseTo(0.75)
  })

  it('charges nothing to stay on the same button and direction within the comfortable run', () => {
    expect(cost(d3push, d3push, ctx(1, 2))).toBe(0)
  })

  it('does not penalise same-direction runs up to the comfort length', () => {
    expect(cost(d3push, d5push, ctx(0.2, 3))).toBe(0)
  })

  it('penalises a same-direction run beyond the comfort length (air)', () => {
    expect(cost(d3push, d5push, ctx(0.2, 5))).toBeCloseTo(0.8)
  })

  it('grows the air penalty as the run lengthens', () => {
    const run5 = cost(d3push, d5push, ctx(0.2, 5))
    const run7 = cost(d3push, d5push, ctx(0.2, 7))
    expect(run7).toBeGreaterThan(run5)
  })

  it('prefers reversing on a strong beat but cross-rowing on a weak one', () => {
    const reversalStrong = cost(d3push, d3pull, ctx(1))
    const rowChange = cost(d3push, g3push, ctx(1))
    expect(reversalStrong).toBeLessThan(rowChange)

    const reversalWeak = cost(d3push, d3pull, ctx(0.2))
    expect(reversalWeak).toBeGreaterThan(rowChange)
  })
})
