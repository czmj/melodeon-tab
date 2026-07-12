import { pitchClass, pitchClassName } from './pitch.ts'

export type ChordQuality = 'maj' | 'min'

export interface Chord {
  root: number
  quality: ChordQuality
}

export interface ChordMatch {
  rootPresent: boolean
  thirdPresent: boolean
  fifthPresent: boolean
  clashingThird: boolean
}

const ROOT_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

function pitchClassSet(pitches: Iterable<number>): Set<number> {
  const set = new Set<number>()
  for (const p of pitches) set.add(pitchClass(p))
  return set
}

export function parseChordSymbol(symbol: string): Chord | null {
  const match = /^([A-G])([#b]?)(.*)$/.exec(symbol.trim())
  if (!match) return null
  let root = ROOT_PC[match[1]]
  if (match[2] === '#') root = pitchClass(root + 1)
  else if (match[2] === 'b') root = pitchClass(root - 1)
  const quality: ChordQuality = /^(m(?!aj)|min|dim|-|°)/.test(match[3]) ? 'min' : 'maj'
  return { root, quality }
}

export function chordLabel(chord: Chord): string {
  return pitchClassName(chord.root) + (chord.quality === 'min' ? 'm' : '')
}

export function deriveChords(pitches: Iterable<number>): Chord[] {
  const set = pitchClassSet(pitches)
  const has = (pc: number) => set.has(pitchClass(pc))
  const chords: Chord[] = []
  for (const root of set) {
    if (!has(root + 7)) continue
    const major = has(root + 4)
    const minor = has(root + 3)
    if (major && !minor) chords.push({ root, quality: 'maj' })
    else if (minor && !major) chords.push({ root, quality: 'min' })
    else if (!major && !minor) chords.push({ root, quality: 'maj' }, { root, quality: 'min' })
  }
  return chords
}

export function analyseMatch(pitches: Iterable<number>, target: Chord): ChordMatch {
  const set = pitchClassSet(pitches)
  const has = (pc: number) => set.has(pitchClass(pc))
  const majorThird = has(target.root + 4)
  const minorThird = has(target.root + 3)
  return {
    rootPresent: has(target.root),
    thirdPresent: target.quality === 'maj' ? majorThird : minorThird,
    fifthPresent: has(target.root + 7),
    clashingThird: target.quality === 'maj' ? minorThird : majorThird,
  }
}

export function matchScore(pitches: Iterable<number>, target: Chord): number {
  const m = analyseMatch(pitches, target)
  return (
    (m.rootPresent ? 3 : 0) +
    (m.thirdPresent ? 2 : 0) +
    (m.fifthPresent ? 1 : 0) +
    (m.clashingThird ? -2 : 0)
  )
}
