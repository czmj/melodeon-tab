import type { Candidate } from './instrument'

export const PPWN = 720

export function wholeNotesToTicks(wholeNotes: number): number {
  return Math.round(wholeNotes * PPWN)
}

export function basicBeatStrength(positionInBarTicks: number, metre: [number, number]): number {
  const [num, den] = metre
  const barTicks = num * (PPWN / den)
  const mainBeats = den === 8 && num % 3 === 0 ? num / 3 : num
  const mainBeatTicks = barTicks / mainBeats
  if (positionInBarTicks === 0) return 1
  if (positionInBarTicks % mainBeatTicks === 0) return 0.6
  return 0.2
}

export interface NoteEvent {
  index: number
  pitch: number
  writtenName: string
  durationTicks: number
  startTicks: number
  bar: number
  startChar: number
  rest: boolean
  flattenedChord?: boolean
  beatStrength: number
  phraseBoundaryBefore: boolean
}

export interface BarMarker {
  beforeNoteIndex: number
  type: string
  startEnding?: string
  endEnding?: boolean
}

export interface Tune {
  title: string
  key: string
  metre: [number, number]
  notes: NoteEvent[]
  bars: BarMarker[]
}

export interface FingeredNote {
  noteIndex: number
  chosen: Candidate | null
  alternatives: Candidate[]
  pinned: boolean
  confidence: number
  costMargin: number
}

export interface FingeringResult {
  tune: Tune
  notes: FingeredNote[]
  totalCost: number
}

export interface CostContext {
  metre: [number, number]
  beatStrength: number
  phraseBoundaryBefore: boolean
  sameDirectionBeats?: number
}

export type CostFn = (from: Candidate | null, to: Candidate, context: CostContext) => number
