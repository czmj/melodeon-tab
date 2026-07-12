export type Direction = 'push' | 'pull'
export type Pitch = number

export interface Button {
  id: string
  row: number
  outside: boolean
  position: number
  push: Pitch[]
  pull: Pitch[]
  role?: 'bass' | 'chord'
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

export function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

export function buttonsInRole(instrument: Instrument, role: 'bass' | 'chord'): Button[] {
  return instrument.bass.buttons.filter((b) => b.role === role)
}

export function resolveCandidate(
  instrument: Instrument,
  candidate: Candidate,
): {
  button: Button
  row: number
  outside: boolean
  position: number
  pitch: Pitch
  pitches: Pitch[]
  role?: 'bass' | 'chord'
} {
  const button =
    instrument.treble.buttons.find((b) => b.id === candidate.buttonId) ??
    instrument.bass.buttons.find((b) => b.id === candidate.buttonId)
  if (!button) throw new Error(`unknown button: ${candidate.buttonId}`)
  const pitches = pitchesInDirection(button, candidate.direction)
  return {
    button,
    row: button.row,
    outside: button.outside,
    position: button.position,
    pitch: pitches[0],
    pitches,
    role: button.role,
  }
}

function button(
  id: string,
  row: number,
  outside: boolean,
  position: number,
  push: Pitch,
  pull: Pitch,
): Button {
  return { id, row, outside, position, push: [push], pull: [pull] }
}

const dRow: Button[] = [
  button('d1', 0, false, 1, 54, 57),
  button('d2', 0, false, 2, 57, 61),
  button('d3', 0, false, 3, 62, 64),
  button('d4', 0, false, 4, 66, 67),
  button('d5', 0, false, 5, 69, 71),
  button('d6', 0, false, 6, 74, 73),
  button('d7', 0, false, 7, 78, 76),
  button('d8', 0, false, 8, 81, 79),
  button('d9', 0, false, 9, 86, 83),
  button('d10', 0, false, 10, 90, 85),
  button('d11', 0, false, 11, 93, 88),
]

const gRow: Button[] = [
  button('g1', 1, true, 1, 59, 62),
  button('g2', 1, true, 2, 62, 66),
  button('g3', 1, true, 3, 67, 69),
  button('g4', 1, true, 4, 71, 72),
  button('g5', 1, true, 5, 74, 76),
  button('g6', 1, true, 6, 79, 78),
  button('g7', 1, true, 7, 83, 81),
  button('g8', 1, true, 8, 86, 84),
  button('g9', 1, true, 9, 91, 88),
  button('g10', 1, true, 10, 95, 90),
]

function bassButton(id: string, row: number, position: number, push: Pitch, pull: Pitch): Button {
  return { id, row, outside: false, position, push: [push], pull: [pull], role: 'bass' }
}

function chordButton(id: string, row: number, position: number, push: Pitch[], pull: Pitch[]): Button {
  return { id, row, outside: false, position, push, pull, role: 'chord' }
}

const bassEnd: Button[] = [
  chordButton('chord1', 0, 1, [50, 54, 57], [57, 61, 64]),
  chordButton('chord2', 1, 1, [59, 63, 66], [52, 55, 59]),
  bassButton('bass1', 0, 2, 50, 45),
  bassButton('bass2', 1, 2, 47, 52),
  chordButton('chord3', 0, 3, [55, 59, 62], [50, 54, 57]),
  chordButton('chord4', 1, 3, [48, 52, 55], [48, 52, 55]),
  bassButton('bass3', 0, 4, 43, 50),
  bassButton('bass4', 1, 4, 48, 48),
]

export const DG_STANDARD: Instrument = {
  id: 'dg-standard',
  name: 'D/G standard (21-button)',
  source:
    'lesterbailey.org "D/G 21 with low notes", verified 2026-07-05; bass end transcribed 2026-07-11, bass octaves assigned by convention (chart gives note names only)',
  treble: { buttons: [...dRow, ...gRow] },
  bass: { buttons: bassEnd },
}
