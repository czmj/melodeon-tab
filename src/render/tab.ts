import { resolveCandidate } from '../domain/instrument.ts'
import type { Candidate, Direction, Instrument } from '../domain/instrument.ts'
import type { FingeringResult } from '../domain/notes.ts'

export function directionArrow(direction: Direction): string {
  return direction === 'push' ? '↑' : '↓'
}

export function candidateLabel(instrument: Instrument, candidate: Candidate): string {
  const { row, position } = resolveCandidate(instrument, candidate)
  return `Row ${row + 1}, button ${position}, ${candidate.direction}`
}

export interface TabCell {
  noteIndex: number
  text: string
  arrow: string
  colour: 'red' | 'blue' | null
  underline: boolean
  playable: boolean
  rest: boolean
  lowConfidence: boolean
}

export function renderTab(result: FingeringResult, instrument: Instrument): TabCell[] {
  return result.notes.map((fingered, i) => {
    const rest = result.tune.notes[i].rest
    if (fingered.chosen === null) {
      return {
        noteIndex: i,
        text: rest ? '-' : '?',
        arrow: '',
        colour: null,
        underline: false,
        playable: false,
        rest,
        lowConfidence: false,
      }
    }
    const { row, position } = resolveCandidate(instrument, fingered.chosen)
    const push = fingered.chosen.direction === 'push'
    return {
      noteIndex: i,
      text: String(position),
      arrow: push ? '↑' : '↓',
      colour: push ? 'red' : 'blue',
      underline: row === 1,
      playable: true,
      rest,
      lowConfidence: fingered.confidence < 1,
    }
  })
}
