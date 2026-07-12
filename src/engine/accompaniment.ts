import {
  buttonsInRole,
  pitchesInDirection,
} from '../domain/instrument.ts'
import type { Button, Candidate, Direction, Instrument } from '../domain/instrument.ts'
import {
  chordLabel,
  deriveChords,
  matchScore,
  parseChordSymbol,
} from '../domain/chord.ts'
import type { Chord } from '../domain/chord.ts'
import { pitchClass, pitchClassName } from '../domain/pitch.ts'
import type { FingeringResult, Tune } from '../domain/notes.ts'

export interface BassSuggestion {
  noteIndex: number
  direction: Direction | null
  target: Chord | null
  bass: Candidate | null
  chord: Candidate | null
  bassLabel: string | null
  chordLabel: string | null
}

function triadTones(chord: Chord): Set<number> {
  return new Set([
    pitchClass(chord.root),
    pitchClass(chord.root + (chord.quality === 'maj' ? 4 : 3)),
    pitchClass(chord.root + 7),
  ])
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

function barPitchWeights(tune: Tune, bar: number): Map<number, number> {
  const weights = new Map<number, number>()
  for (const note of tune.notes) {
    if (note.bar !== bar || note.rest || note.pitch <= 0) continue
    const pc = pitchClass(note.pitch)
    weights.set(pc, (weights.get(pc) ?? 0) + note.durationTicks)
  }
  return weights
}

function fallbackTarget(weights: Map<number, number>, candidates: Chord[]): Chord | null {
  if (weights.size === 0) return null
  let best: Chord | null = null
  let bestScore = 0
  for (const chord of candidates) {
    const tones = triadTones(chord)
    let score = 0
    for (const [pc, weight] of weights) if (tones.has(pc)) score += weight
    if (score > bestScore) {
      bestScore = score
      best = chord
    }
  }
  return best
}

function computeTargets(tune: Tune, instrument: Instrument): (Chord | null)[] {
  const candidates = playableChords(instrument)
  const filled: (Chord | null)[] = []
  let carried: Chord | null = null
  for (const note of tune.notes) {
    if (note.chordSymbol) {
      const parsed = parseChordSymbol(note.chordSymbol)
      if (parsed) carried = parsed
    }
    filled.push(carried)
  }
  const barFallback = new Map<number, Chord | null>()
  return tune.notes.map((note, i) => {
    if (filled[i]) return filled[i]
    if (!barFallback.has(note.bar)) {
      barFallback.set(note.bar, fallbackTarget(barPitchWeights(tune, note.bar), candidates))
    }
    return barFallback.get(note.bar) ?? null
  })
}

function bestButton(
  buttons: Button[],
  direction: Direction,
  target: Chord,
): { button: Button; candidate: Candidate } | null {
  let best: { button: Button; candidate: Candidate } | null = null
  let bestScore = 0
  for (const button of buttons) {
    const score = matchScore(pitchesInDirection(button, direction), target)
    if (score > bestScore) {
      bestScore = score
      best = { button, candidate: { buttonId: button.id, direction } }
    }
  }
  return best
}

function bassLabelFor(button: Button, direction: Direction): string {
  return pitchClassName(pitchesInDirection(button, direction)[0])
}

function chordLabelFor(button: Button, direction: Direction): string | null {
  const derived = deriveChords(pitchesInDirection(button, direction))
  return derived.length > 0 ? chordLabel(derived[0]) : null
}

export function suggestAccompaniment(
  tune: Tune,
  fingering: FingeringResult,
  instrument: Instrument,
): BassSuggestion[] {
  const targets = computeTargets(tune, instrument)
  const bassButtons = buttonsInRole(instrument, 'bass')
  const chordButtons = buttonsInRole(instrument, 'chord')

  return tune.notes.map((_, i) => {
    const direction = fingering.notes[i]?.chosen?.direction ?? null
    const target = targets[i]
    if (!direction || !target) {
      return { noteIndex: i, direction, target, bass: null, chord: null, bassLabel: null, chordLabel: null }
    }
    const bass = bestButton(bassButtons, direction, target)
    const chord = bestButton(chordButtons, direction, target)
    return {
      noteIndex: i,
      direction,
      target,
      bass: bass?.candidate ?? null,
      chord: chord?.candidate ?? null,
      bassLabel: bass ? bassLabelFor(bass.button, direction) : null,
      chordLabel: chord ? chordLabelFor(chord.button, direction) : null,
    }
  })
}
