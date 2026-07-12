import { resolveCandidate } from '../domain/instrument.ts'
import type { Candidate, Instrument } from '../domain/instrument.ts'
import type { FingeringResult } from '../domain/notes.ts'

export function candidateLabel(instrument: Instrument, candidate: Candidate): string {
  const { row, position } = resolveCandidate(instrument, candidate)
  return `Row ${row + 1}, button ${position}, ${candidate.direction}`
}

export interface TabCell {
  noteIndex: number
  text: string
  pull: boolean
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
        pull: false,
        playable: false,
        rest,
        lowConfidence: false,
      }
    }
    const { row, position } = resolveCandidate(instrument, fingered.chosen)
    const push = fingered.chosen.direction === 'push'
    const outsideRow = row === 1
    return {
      noteIndex: i,
      text: outsideRow ? `(${position})` : String(position),
      pull: !push,
      playable: true,
      rest,
      lowConfidence: fingered.confidence < 1,
    }
  })
}
