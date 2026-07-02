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
  treble: Keyboard
  bass: Keyboard
}

export interface Candidate {
  buttonId: string
  row: number
  direction: Direction
}

export const DG_TREBLE_PLACEHOLDER: Instrument = {
  id: 'dg-standard',
  name: 'D/G standard (PLACEHOLDER — verify pitch map against a real box, see roadmap step 2)',
  treble: { buttons: [] },
  bass: { buttons: [] },
}
