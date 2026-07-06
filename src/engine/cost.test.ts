import { describe, expect, it } from 'vitest'
import { DG_STANDARD } from '../domain/instrument.ts'
import type { CostContext } from '../domain/notes.ts'
import { NAIVE_WEIGHTS, makeCostFn } from './cost.ts'

const ctx: CostContext = { metre: [4, 4], beatStrength: 1, phraseBoundaryBefore: false }

describe('makeCostFn', () => {
  const cost = makeCostFn(DG_STANDARD, NAIVE_WEIGHTS)

  it('is free to enter from no previous note', () => {
    expect(cost(null, { buttonId: 'd3', direction: 'push' }, ctx)).toBe(0)
  })

  it('charges the reversal weight for a bellows-direction change', () => {
    expect(
      cost({ buttonId: 'd3', direction: 'push' }, { buttonId: 'd3', direction: 'pull' }, ctx),
    ).toBe(1)
  })

  it('charges the row-change weight for a same-direction cross-row move', () => {
    expect(
      cost({ buttonId: 'd3', direction: 'push' }, { buttonId: 'g3', direction: 'push' }, ctx),
    ).toBe(0.5)
  })

  it('charges both for a cross-row reversal', () => {
    expect(
      cost({ buttonId: 'd3', direction: 'push' }, { buttonId: 'g1', direction: 'pull' }, ctx),
    ).toBe(1.5)
  })

  it('charges nothing to stay on the same button and direction', () => {
    expect(
      cost({ buttonId: 'd3', direction: 'push' }, { buttonId: 'd3', direction: 'push' }, ctx),
    ).toBe(0)
  })
})
