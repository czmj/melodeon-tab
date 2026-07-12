import type { BassSuggestion } from '../engine/accompaniment.ts'

export interface BassCell {
  noteIndex: number
  pull: boolean | null
  bassText: string | null
  chordText: string | null
}

export function renderBassLine(suggestions: BassSuggestion[]): BassCell[] {
  return suggestions.map((s) => ({
    noteIndex: s.noteIndex,
    pull: s.direction ? s.direction === 'pull' : null,
    bassText: s.bassLabel,
    chordText: s.chordLabel ? s.chordLabel.toLowerCase() : null,
  }))
}

export interface BassToken {
  noteIndex: number
  text: string
  pull: boolean
}

export interface BassLineRows {
  bass: BassToken[]
  chord: BassToken[]
}

export function collapseBassLine(cells: BassCell[]): BassLineRows {
  const bass: BassToken[] = []
  const chord: BassToken[] = []
  let lastBass: string | undefined
  let lastChord: string | undefined
  for (const cell of cells) {
    if (cell.bassText !== null) {
      const key = `${cell.bassText}|${cell.pull === true}`
      if (key !== lastBass) {
        bass.push({ noteIndex: cell.noteIndex, text: cell.bassText, pull: cell.pull === true })
        lastBass = key
      }
    }
    if (cell.chordText !== null) {
      const key = `${cell.chordText}|${cell.pull === true}`
      if (key !== lastChord) {
        chord.push({ noteIndex: cell.noteIndex, text: cell.chordText, pull: cell.pull === true })
        lastChord = key
      }
    }
  }
  return { bass, chord }
}
