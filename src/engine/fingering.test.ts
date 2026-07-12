import { describe, expect, it } from 'vitest'
import type { Candidate } from '../domain/instrument.ts'
import type { CostFn, Tune } from '../domain/notes.ts'
import { computeFingering } from './fingering.ts'
import { mapTuneCandidates } from './candidates.ts'
import { makeCostFn } from './cost.ts'
import { DG_STANDARD } from '../domain/instrument.ts'
import { parseAbc } from '../parse/parseAbc.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

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

const greedyTrap: Candidate[][] = [[push('X'), push('Y')], [push('P')]]
const trapCost: CostFn = (from, to) => {
  if (from === null) return to.buttonId === 'Y' ? 5 : 0
  if (from.buttonId === 'X' && to.buttonId === 'P') return 10
  return 0
}

describe('computeFingering', () => {
  it('finds the global optimum, not the greedy choice', () => {
    const result = computeFingering(fakeTune(2), greedyTrap, trapCost)
    expect(result.notes.map((n) => n.chosen?.buttonId)).toEqual(['Y', 'P'])
  })

  it('honours a pin and recomputes around it', () => {
    const pins = new Map<number, Candidate>([[0, push('X')]])
    const result = computeFingering(fakeTune(2), greedyTrap, trapCost, pins)
    expect(result.notes[0].chosen?.buttonId).toBe('X')
    expect(result.notes[0].pinned).toBe(true)
    expect(result.notes[1].chosen?.buttonId).toBe('P')
  })

  it('lists the other candidates as alternatives, excluding the chosen one', () => {
    const result = computeFingering(fakeTune(2), greedyTrap, () => 0)
    const first = result.notes[0]
    expect(first.chosen).not.toBeNull()
    expect(first.alternatives).toHaveLength(1)
    expect(first.alternatives.some((c) => c.buttonId === first.chosen?.buttonId)).toBe(false)
  })

  it('fingers every playable note in a real tune', () => {
    const moon = parseAbc(moonAbc)[0]
    const result = computeFingering(moon, mapTuneCandidates(moon, DG_STANDARD), makeCostFn(DG_STANDARD))
    moon.notes.forEach((note, i) => {
      if (!note.rest) expect(result.notes[i].chosen).not.toBeNull()
    })
  })

  it('leaves an unplayable note (diatonic gap) with no fingering', () => {
    const jiggery = parseAbc(jiggeryAbc)[0]
    const result = computeFingering(jiggery, mapTuneCandidates(jiggery, DG_STANDARD), makeCostFn(DG_STANDARD))
    const gapIndex = jiggery.notes.findIndex((n) => n.writtenName === '^A')
    expect(result.notes[gapIndex].chosen).toBeNull()
  })

  it('breaks a long single-direction run when bellows-air pressure builds', () => {
    const pull = (buttonId: string): Candidate => ({ buttonId, direction: 'pull' })
    const lattice: Candidate[][] = Array.from({ length: 8 }, () => [push('p'), pull('q')])
    const airCost: CostFn = (from, to, context) => {
      if (from === null) return 0
      if (from.direction !== to.direction) return 1
      const beats = context.sameDirectionBeats ?? 0
      return beats >= 3 ? beats - 2 : 0
    }
    const result = computeFingering(fakeTune(8), lattice, airCost)
    const directions = new Set(result.notes.map((n) => n.chosen?.direction))
    expect(directions.size).toBe(2)
  })
})
