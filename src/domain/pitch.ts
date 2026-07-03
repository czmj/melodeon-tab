const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export function midiToName(midi: number): string {
  return `${noteNames[midi % 12]}${Math.floor(midi / 12) - 1}`
}
