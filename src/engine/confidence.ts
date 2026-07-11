import type { Candidate } from '../domain/instrument.ts'
import type { CostFn, FingeringResult, Tune } from '../domain/notes.ts'
import { computeFingering } from './fingering.ts'

const LOW_CONFIDENCE_MARGIN = 0.1

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

export function fingerWithConfidence(
  tune: Tune,
  lattice: Candidate[][],
  cost: CostFn,
  pins: Map<number, Candidate> = new Map(),
): FingeringResult {
  const base = computeFingering(tune, lattice, cost, pins)

  for (const fingered of base.notes) {
    const i = fingered.noteIndex
    const chosen = fingered.chosen
    if (chosen === null || pins.has(i)) {
      fingered.costMargin = Infinity
      fingered.confidence = 1
      continue
    }
    const alternatives = (lattice[i] ?? []).filter((c) => !sameCandidate(c, chosen))
    if (alternatives.length === 0) {
      fingered.costMargin = Infinity
      fingered.confidence = 1
      continue
    }
    let bestAlternative = Infinity
    for (const alternative of alternatives) {
      const forced = new Map(pins)
      forced.set(i, alternative)
      bestAlternative = Math.min(bestAlternative, computeFingering(tune, lattice, cost, forced).totalCost)
    }
    const margin = bestAlternative - base.totalCost
    fingered.costMargin = margin
    fingered.confidence = margin >= LOW_CONFIDENCE_MARGIN ? 1 : Math.max(0, margin) / LOW_CONFIDENCE_MARGIN
  }

  return base
}
