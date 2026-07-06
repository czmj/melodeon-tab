import { resolveCandidate } from '../domain/instrument.ts'
import type { Instrument } from '../domain/instrument.ts'
import type { FingeringResult } from '../domain/notes.ts'

export interface TabCell {
  noteIndex: number
  token: string
  playable: boolean
  rest: boolean
}

export function renderTab(result: FingeringResult, instrument: Instrument): TabCell[] {
  return result.notes.map((fingered, i) => {
    const rest = result.tune.notes[i].rest
    if (fingered.chosen === null) {
      return { noteIndex: i, token: rest ? '-' : '?', playable: false, rest }
    }
    const { row, position } = resolveCandidate(instrument, fingered.chosen)
    const rowMark = row === 1 ? "'" : ''
    const directionMark = fingered.chosen.direction === 'pull' ? '_' : ''
    return { noteIndex: i, token: `${position}${rowMark}${directionMark}`, playable: true, rest }
  })
}
