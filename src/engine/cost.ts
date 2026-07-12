import { resolveCandidate } from '../domain/instrument.ts'
import type { Instrument } from '../domain/instrument.ts'
import type { CostFn } from '../domain/notes.ts'

export interface CostWeights {
  reversalStrong: number
  reversalWeak: number
  rowChange: number
  airPenaltyRate: number
  airComfortBeats: number
  directionBiasWritten: number
  directionBiasFallback: number
}

export const DEFAULT_WEIGHTS: CostWeights = {
  reversalStrong: 0.25,
  reversalWeak: 1.5,
  rowChange: 0.5,
  airPenaltyRate: 0.4,
  airComfortBeats: 8,
  directionBiasWritten: 3,
  directionBiasFallback: 0.6,
}

export function makeCostFn(instrument: Instrument, weights: CostWeights = DEFAULT_WEIGHTS): CostFn {
  return (from, to, context) => {
    let cost = 0
    if (context.preferredDirection && to.direction !== context.preferredDirection) {
      cost +=
        context.harmonySource === 'written'
          ? weights.directionBiasWritten
          : weights.directionBiasFallback
    }
    if (from === null) return cost
    if (from.direction !== to.direction) {
      cost += weights.reversalWeak - (weights.reversalWeak - weights.reversalStrong) * context.beatStrength
    } else {
      const beats = context.sameDirectionBeats ?? 0
      cost += weights.airPenaltyRate * Math.max(0, beats - weights.airComfortBeats)
    }
    if (resolveCandidate(instrument, from).row !== resolveCandidate(instrument, to).row) {
      cost += weights.rowChange
    }
    return cost
  }
}
