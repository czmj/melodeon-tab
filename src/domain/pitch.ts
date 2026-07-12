const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToName(midi: number): string {
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`
}

export function pitchClass(pitch: number): number {
  return ((pitch % 12) + 12) % 12
}

export function pitchClassName(pitch: number): string {
  return noteNames[pitchClass(pitch)]
}
