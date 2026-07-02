import type { Candidate } from './instrument'

export interface NoteEvent {
  index: number
  pitch: number
  durationTicks: number
  startTicks: number
  bar: number
  beatStrength: number
  phraseBoundaryBefore: boolean
}

export interface Tune {
  title: string
  key: string
  metre: [number, number]
  notes: NoteEvent[]
}

export interface FingeredNote {
  noteIndex: number
  chosen: Candidate | null
  alternatives: Candidate[]
  pinned: boolean
  confidence: number
}

export interface FingeringResult {
  tune: Tune
  notes: FingeredNote[]
}

export interface CostContext {
  metre: [number, number]
  beatStrength: number
  phraseBoundaryBefore: boolean
}

export type CostFn = (
  from: Candidate | null,
  to: Candidate,
  context: CostContext
) => number
