import { buttonsInRole, pitchesInDirection } from '../domain/instrument.ts'
import type { Button, Direction, Instrument } from '../domain/instrument.ts'
import { chordLabel, deriveChords, matchScore, parseChordSymbol, triadTones } from '../domain/chord.ts'
import type { Chord, ChordQuality } from '../domain/chord.ts'
import { pitchClass } from '../domain/pitch.ts'
import { PPWN } from '../domain/notes.ts'
import type { NoteEvent, Tune } from '../domain/notes.ts'

export type HarmonySource = 'written' | 'fallback'

export interface NoteHarmony {
  target: Chord | null
  source: HarmonySource | null
  preferredDirection: Direction | null
  label: string | null
}

function sameChord(a: Chord, b: Chord): boolean {
  return a.root === b.root && a.quality === b.quality
}

function playableChords(instrument: Instrument): Chord[] {
  const chords: Chord[] = []
  for (const button of buttonsInRole(instrument, 'chord')) {
    for (const direction of ['push', 'pull'] as const) {
      for (const chord of deriveChords(pitchesInDirection(button, direction))) {
        if (!chords.some((c) => sameChord(c, chord))) chords.push(chord)
      }
    }
  }
  return chords
}

type Degree = { quality: ChordQuality; weight: number }

const MAJOR_KEY: Record<number, Degree> = {
  0: { quality: 'maj', weight: 1.5 }, // I
  2: { quality: 'min', weight: 1.0 }, // ii
  4: { quality: 'min', weight: 1.0 }, // iii
  5: { quality: 'maj', weight: 1.3 }, // IV
  7: { quality: 'maj', weight: 1.3 }, // V
  9: { quality: 'min', weight: 1.05 }, // vi
}

const MINOR_KEY: Record<number, Degree> = {
  0: { quality: 'min', weight: 1.5 }, // i
  3: { quality: 'maj', weight: 1.3 }, // III
  5: { quality: 'min', weight: 1.3 }, // iv
  7: { quality: 'maj', weight: 1.3 }, // V (harmonic minor)
  8: { quality: 'maj', weight: 1.05 }, // VI
  10: { quality: 'maj', weight: 1.05 }, // VII
}

const OFF_KEY_WEIGHT = 0.6

function keyWeight(chord: Chord, key: Chord | null): number {
  if (!key) return 1
  const table = key.quality === 'min' ? MINOR_KEY : MAJOR_KEY
  const degree = table[pitchClass(chord.root - key.root)]
  return degree && degree.quality === chord.quality ? degree.weight : OFF_KEY_WEIGHT
}

function mainBeatTicks(metre: [number, number]): number {
  const [num, den] = metre
  const barTicks = num * (PPWN / den)
  const mainBeats = den === 8 && num % 3 === 0 ? num / 3 : num
  return mainBeats > 0 ? barTicks / mainBeats : barTicks
}

function chordScore(weights: Map<number, number>, chord: Chord, key: Chord | null): number {
  const tones = triadTones(chord)
  let coverage = 0
  for (const [pc, weight] of weights) if (tones.has(pc)) coverage += weight
  return coverage * keyWeight(chord, key)
}

function segmentFallback(
  tune: Tune,
  candidates: Chord[],
  key: Chord | null,
): (Chord | null)[] {
  const beat = mainBeatTicks(tune.metre)
  const barStart = new Map<number, number>()
  for (const note of tune.notes) {
    const seen = barStart.get(note.bar)
    if (seen === undefined || note.startTicks < seen) barStart.set(note.bar, note.startTicks)
  }
  const segmentOf = (note: NoteEvent): string => {
    const pos = note.startTicks - (barStart.get(note.bar) ?? note.startTicks)
    return `${note.bar}:${beat > 0 ? Math.floor(pos / beat) : 0}`
  }

  const order: string[] = []
  const weights = new Map<string, Map<number, number>>()
  for (const note of tune.notes) {
    if (note.rest || note.pitch <= 0) continue
    const id = segmentOf(note)
    let w = weights.get(id)
    if (!w) {
      w = new Map()
      weights.set(id, w)
      order.push(id)
    }
    const pc = pitchClass(note.pitch)
    w.set(pc, (w.get(pc) ?? 0) + note.durationTicks)
  }

  // A rival chord must beat the held one by at least a main beat's worth of coverage to take
  // over the segment — stops the fallback flip-flopping on a single passing note.
  const changeThreshold = beat
  const chosen = new Map<string, Chord | null>()
  let current: Chord | null = null
  for (const id of order) {
    const w = weights.get(id)!
    let best: Chord | null = null
    let bestScore = 0
    for (const chord of candidates) {
      const score = chordScore(w, chord, key)
      if (score > bestScore) {
        bestScore = score
        best = chord
      }
    }
    if (best) {
      if (current === null) {
        current = best
      } else if (!sameChord(best, current) && bestScore > chordScore(w, current, key) + changeThreshold) {
        current = best
      }
    }
    chosen.set(id, current)
  }

  return tune.notes.map((note) =>
    note.rest || note.pitch <= 0 ? null : chosen.get(segmentOf(note)) ?? null,
  )
}

export function bestButtonInDirection(
  buttons: Button[],
  direction: Direction,
  target: Chord,
): { button: Button; score: number } | null {
  let best: { button: Button; score: number } | null = null
  let bestScore = 0
  for (const button of buttons) {
    const score = matchScore(pitchesInDirection(button, direction), target)
    if (score > bestScore) {
      bestScore = score
      best = { button, score }
    }
  }
  return best
}

function directionScore(instrument: Instrument, direction: Direction, target: Chord): number {
  const chord = bestButtonInDirection(buttonsInRole(instrument, 'chord'), direction, target)
  const bass = bestButtonInDirection(buttonsInRole(instrument, 'bass'), direction, target)
  return (chord?.score ?? 0) + (bass?.score ?? 0)
}

export function preferredDirection(instrument: Instrument, target: Chord): Direction | null {
  const push = directionScore(instrument, 'push', target)
  const pull = directionScore(instrument, 'pull', target)
  if (push > pull) return 'push'
  if (pull > push) return 'pull'
  return null
}

export function analyseHarmony(tune: Tune, instrument: Instrument): NoteHarmony[] {
  const candidates = playableChords(instrument)
  const tuneKey = parseChordSymbol(tune.key)

  const changes = tune.chordChanges
  const written: ({ chord: Chord; symbol: string } | null)[] = []
  let ci = 0
  let current: { chord: Chord; symbol: string } | null = null
  for (const note of tune.notes) {
    while (ci < changes.length && changes[ci].startTicks <= note.startTicks) {
      current = { chord: changes[ci].chord, symbol: changes[ci].symbol }
      ci += 1
    }
    written.push(current)
  }

  const fallback = segmentFallback(tune, candidates, tuneKey)
  const prefCache = new Map<string, Direction | null>()
  const prefFor = (target: Chord): Direction | null => {
    const key = `${target.root}:${target.quality}`
    if (!prefCache.has(key)) prefCache.set(key, preferredDirection(instrument, target))
    return prefCache.get(key) ?? null
  }

  return tune.notes.map((note, i) => {
    const explicit = written[i]
    if (explicit) {
      return {
        target: explicit.chord,
        source: 'written',
        preferredDirection: prefFor(explicit.chord),
        label: explicit.symbol,
      }
    }
    const target = fallback[i]
    if (!target) return { target: null, source: null, preferredDirection: null, label: null }
    return { target, source: 'fallback', preferredDirection: prefFor(target), label: chordLabel(target) }
  })
}
