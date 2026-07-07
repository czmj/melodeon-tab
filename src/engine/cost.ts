import { resolveCandidate } from '../domain/instrument.ts'
import type { Instrument } from '../domain/instrument.ts'
import type { CostFn } from '../domain/notes.ts'

export interface CostWeights {
  reversalStrong: number
  reversalWeak: number
  rowChange: number
  air: number
  airComfort: number
}

export const DEFAULT_WEIGHTS: CostWeights = {
  reversalStrong: 0.25,
  reversalWeak: 1.5,
  rowChange: 0.5,
  air: 0.4,
  airComfort: 3,
}

export function makeCostFn(instrument: Instrument, weights: CostWeights = DEFAULT_WEIGHTS): CostFn {
  return (from, to, context) => {
    if (from === null) return 0
    let cost = 0
    if (from.direction !== to.direction) {
      cost += weights.reversalWeak - (weights.reversalWeak - weights.reversalStrong) * context.beatStrength
    } else {
      const run = context.sameDirectionRun ?? 0
      cost += weights.air * Math.max(0, run - weights.airComfort)
    }
    if (resolveCandidate(instrument, from).row !== resolveCandidate(instrument, to).row) {
      cost += weights.rowChange
    }
    return cost
  }
}
