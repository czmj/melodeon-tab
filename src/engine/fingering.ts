import type { Candidate } from '../domain/instrument.ts'
import type { CostContext, CostFn, FingeredNote, FingeringResult, Tune } from '../domain/notes.ts'

interface Node {
  candidate: Candidate
  cost: number
  back: number
}

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

export function computeFingering(
  tune: Tune,
  lattice: Candidate[][],
  cost: CostFn,
  pins: Map<number, Candidate> = new Map(),
): FingeringResult {
  const columns: (Node[] | null)[] = []
  let prev: Node[] | null = null

  for (let i = 0; i < tune.notes.length; i++) {
    const note = tune.notes[i]
    const context: CostContext = {
      metre: tune.metre,
      beatStrength: note.beatStrength,
      phraseBoundaryBefore: note.phraseBoundaryBefore,
    }
    const pinned = pins.get(i)
    const candidates = pinned ? [pinned] : (lattice[i] ?? [])

    if (candidates.length === 0) {
      columns.push(null)
      prev = null
      continue
    }

    const previous = prev
    const nodes: Node[] = candidates.map((to) => {
      if (previous === null) {
        return { candidate: to, cost: cost(null, to, context), back: -1 }
      }
      let best = Infinity
      let bestBack = -1
      for (let j = 0; j < previous.length; j++) {
        const total = previous[j].cost + cost(previous[j].candidate, to, context)
        if (total < best) {
          best = total
          bestBack = j
        }
      }
      return { candidate: to, cost: best, back: bestBack }
    })
    columns.push(nodes)
    prev = nodes
  }

  const chosen: (Candidate | null)[] = new Array(tune.notes.length).fill(null)
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

  return { tune, notes }
}
