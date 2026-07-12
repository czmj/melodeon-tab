import type { Candidate } from '../domain/instrument.ts'
import { sameCandidate } from '../domain/instrument.ts'
import type { CostContext, CostFn, FingeredNote, FingeringResult, Tune } from '../domain/notes.ts'
import { PPWN } from '../domain/notes.ts'
import type { NoteHarmony } from './harmony.ts'

const TICKS_PER_BEAT = PPWN / 4
const RUN_CAP_TICKS = 12 * TICKS_PER_BEAT

interface Node {
  candidate: Candidate
  runTicks: number
  cost: number
  back: number
}

export function computeFingering(
  tune: Tune,
  lattice: Candidate[][],
  cost: CostFn,
  pins: Map<number, Candidate> = new Map(),
  harmony?: NoteHarmony[],
): FingeringResult {
  const columns: (Node[] | null)[] = []
  let prev: Node[] | null = null

  for (let i = 0; i < tune.notes.length; i++) {
    const note = tune.notes[i]
    const pinned = pins.get(i)
    const candidates = pinned ? [pinned] : (lattice[i] ?? [])

    if (candidates.length === 0) {
      columns.push(null)
      prev = null
      continue
    }

    const h = harmony?.[i]
    const baseContext = {
      metre: tune.metre,
      beatStrength: note.beatStrength,
      phraseBoundaryBefore: note.phraseBoundaryBefore,
      preferredDirection: h?.preferredDirection ?? undefined,
      harmonySource: h?.source ?? undefined,
    }
    const previous = prev
    const nodes: Node[] = []

    for (const to of candidates) {
      if (previous === null) {
        const context: CostContext = { ...baseContext, sameDirectionBeats: 0 }
        const runTicks = Math.min(note.durationTicks, RUN_CAP_TICKS)
        nodes.push({ candidate: to, runTicks, cost: cost(null, to, context), back: -1 })
        continue
      }
      const bestByRunTicks = new Map<number, { cost: number; back: number }>()
      for (let j = 0; j < previous.length; j++) {
        const p = previous[j]
        const incomingRunTicks = note.phraseBoundaryBefore ? 0 : p.runTicks
        const context: CostContext = { ...baseContext, sameDirectionBeats: incomingRunTicks / TICKS_PER_BEAT }
        const sameDirection = p.candidate.direction === to.direction
        const runTicks = Math.min(
          sameDirection ? incomingRunTicks + note.durationTicks : note.durationTicks,
          RUN_CAP_TICKS,
        )
        const total = p.cost + cost(p.candidate, to, context)
        const existing = bestByRunTicks.get(runTicks)
        if (!existing || total < existing.cost) {
          bestByRunTicks.set(runTicks, { cost: total, back: j })
        }
      }
      for (const [runTicks, best] of bestByRunTicks) {
        nodes.push({ candidate: to, runTicks, cost: best.cost, back: best.back })
      }
    }
    columns.push(nodes)
    prev = nodes
  }

  const chosen: (Candidate | null)[] = new Array(tune.notes.length).fill(null)
  let totalCost = 0
  let i = tune.notes.length - 1
  while (i >= 0) {
    const column = columns[i]
    if (column === null) {
      i -= 1
      continue
    }
    let k = 0
    for (let j = 1; j < column.length; j++) {
      if (column[j].cost < column[k].cost) k = j
    }
    totalCost += column[k].cost
    let ci = i
    let ni = k
    while (ci >= 0) {
      const col = columns[ci]
      if (col === null) break
      const node = col[ni]
      chosen[ci] = node.candidate
      ci -= 1
      if (node.back === -1) break
      ni = node.back
    }
    i = ci
  }

  const notes: FingeredNote[] = tune.notes.map((_, index) => {
    const choice = chosen[index]
    const all = lattice[index] ?? []
    return {
      noteIndex: index,
      chosen: choice,
      alternatives: choice ? all.filter((c) => !sameCandidate(c, choice)) : all,
      pinned: pins.has(index),
      confidence: 1,
      costMargin: 0,
    }
  })

  return { tune, notes, totalCost }
}
