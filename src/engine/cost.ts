import { resolveCandidate } from '../domain/instrument.ts'
import type { Instrument } from '../domain/instrument.ts'
import type { CostFn } from '../domain/notes.ts'

export interface CostWeights {
  reversal: number
  rowChange: number
}

export const NAIVE_WEIGHTS: CostWeights = { reversal: 1, rowChange: 0.5 }

export function makeCostFn(instrument: Instrument, weights: CostWeights = NAIVE_WEIGHTS): CostFn {
  return (from, to) => {
    if (from === null) return 0
    let cost = 0
    if (from.direction !== to.direction) cost += weights.reversal
    if (resolveCandidate(instrument, from).row !== resolveCandidate(instrument, to).row) {
      cost += weights.rowChange
    }
    return cost
  }
}
