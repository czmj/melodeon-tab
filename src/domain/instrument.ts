export type Direction = 'push' | 'pull'
export type Pitch = number

export interface Button {
  id: string
  row: number
  position: number
  push: Pitch[]
  pull: Pitch[]
}

export interface Keyboard {
  buttons: Button[]
}

export interface Instrument {
  id: string
  name: string
  source?: string
  treble: Keyboard
  bass: Keyboard
}

export interface Candidate {
  buttonId: string
  direction: Direction
}

export function pitchesInDirection(button: Button, direction: Direction): Pitch[] {
  return direction === 'push' ? button.push : button.pull
}

export function candidatesForPitch(instrument: Instrument, midi: Pitch): Candidate[] {
  const result: Candidate[] = []
  for (const button of instrument.treble.buttons) {
    if (button.push.includes(midi)) result.push({ buttonId: button.id, direction: 'push' })
    if (button.pull.includes(midi)) result.push({ buttonId: button.id, direction: 'pull' })
  }
  return result
}

export function resolveCandidate(
  instrument: Instrument,
  candidate: Candidate,
): { button: Button; row: number; position: number; pitch: Pitch } {
  const button = instrument.treble.buttons.find((b) => b.id === candidate.buttonId)
  if (!button) throw new Error(`unknown button: ${candidate.buttonId}`)
  const pitches = pitchesInDirection(button, candidate.direction)
  return { button, row: button.row, position: button.position, pitch: pitches[0] }
}

function button(id: string, row: number, position: number, push: Pitch, pull: Pitch): Button {
  return { id, row, position, push: [push], pull: [pull] }
}

const dRow: Button[] = [
  button('d1', 0, 1, 54, 57),
  button('d2', 0, 2, 57, 61),
  button('d3', 0, 3, 62, 64),
  button('d4', 0, 4, 66, 67),
  button('d5', 0, 5, 69, 71),
  button('d6', 0, 6, 74, 73),
  button('d7', 0, 7, 78, 76),
  button('d8', 0, 8, 81, 79),
  button('d9', 0, 9, 86, 83),
  button('d10', 0, 10, 90, 85),
  button('d11', 0, 11, 93, 88),
]

const gRow: Button[] = [
  button('g1', 1, 1, 59, 62),
  button('g2', 1, 2, 62, 66),
  button('g3', 1, 3, 67, 69),
  button('g4', 1, 4, 71, 72),
  button('g5', 1, 5, 74, 76),
  button('g6', 1, 6, 79, 78),
  button('g7', 1, 7, 83, 81),
  button('g8', 1, 8, 86, 84),
  button('g9', 1, 9, 91, 88),
  button('g10', 1, 10, 95, 90),
]

export const DG_STANDARD: Instrument = {
  id: 'dg-standard',
  name: 'D/G standard (21-button)',
  source: 'lesterbailey.org "D/G 21 with low notes", verified 2026-07-05',
  treble: { buttons: [...dRow, ...gRow] },
  bass: { buttons: [] },
}
