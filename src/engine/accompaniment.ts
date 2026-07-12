import { buttonsInRole, pitchesInDirection } from '../domain/instrument.ts'
import type { Button, Candidate, Direction, Instrument } from '../domain/instrument.ts'
import { chordLabel, deriveChords } from '../domain/chord.ts'
import type { Chord } from '../domain/chord.ts'
import { pitchClassName } from '../domain/pitch.ts'
import type { FingeringResult, Tune } from '../domain/notes.ts'
import { analyseHarmony, bestButtonInDirection, preferredDirection } from './harmony.ts'
import type { NoteHarmony } from './harmony.ts'

export interface BassSuggestion {
  noteIndex: number
  direction: Direction | null
  target: Chord | null
  bass: Candidate | null
  chord: Candidate | null
  bassLabel: string | null
  chordLabel: string | null
}

function bassLabelFor(button: Button, direction: Direction): string {
  return pitchClassName(pitchesInDirection(button, direction)[0])
}

function chordLabelFor(button: Button, direction: Direction): string | null {
  const derived = deriveChords(pitchesInDirection(button, direction))
  return derived.length > 0 ? chordLabel(derived[0]) : null
}

const empty = (
  i: number,
  direction: Direction | null,
  target: Chord | null,
): BassSuggestion => ({
  noteIndex: i,
  direction,
  target,
  bass: null,
  chord: null,
  bassLabel: null,
  chordLabel: null,
})

export function suggestAccompaniment(
  tune: Tune,
  fingering: FingeringResult,
  instrument: Instrument,
  harmony: NoteHarmony[] = analyseHarmony(tune, instrument),
): BassSuggestion[] {
  const bassButtons = buttonsInRole(instrument, 'bass')
  const chordButtons = buttonsInRole(instrument, 'chord')

  return tune.notes.map((_, i) => {
    const direction = fingering.notes[i]?.chosen?.direction ?? null
    const { target, preferredDirection } = harmony[i]
    const offSpanDirection =
      preferredDirection !== null && direction !== null && direction !== preferredDirection
    if (!direction || !target || offSpanDirection) return empty(i, direction, target)

    const bass = bestButtonInDirection(bassButtons, direction, target)
    const chord = bestButtonInDirection(chordButtons, direction, target)
    return {
      noteIndex: i,
      direction,
      target,
      bass: bass ? { buttonId: bass.button.id, direction } : null,
      chord: chord ? { buttonId: chord.button.id, direction } : null,
      bassLabel: bass ? bassLabelFor(bass.button, direction) : null,
      chordLabel: chord ? chordLabelFor(chord.button, direction) : null,
    }
  })
}

export interface AccToken {
  startChar: number
  text: string
  pull: boolean
}

export interface AccompanimentDisplay {
  chordNames: AccToken[]
  bass: AccToken[]
  chord: AccToken[]
}

interface DisplayPoint {
  startChar: number
  startTicks: number
  name: string
  bassText: string | null
  chordText: string | null
  pull: boolean
  barStart: boolean
}

function soundingDirection(
  tune: Tune,
  fingering: FingeringResult,
  ticks: number,
): Direction | null {
  for (let i = 0; i < tune.notes.length; i++) {
    const note = tune.notes[i]
    if (note.startTicks <= ticks && ticks < note.startTicks + note.durationTicks) {
      return fingering.notes[i]?.chosen?.direction ?? null
    }
  }
  return null
}

export function accompanimentDisplay(
  tune: Tune,
  fingering: FingeringResult,
  instrument: Instrument,
  harmony: NoteHarmony[] = analyseHarmony(tune, instrument),
): AccompanimentDisplay {
  const suggestions = suggestAccompaniment(tune, fingering, instrument, harmony)
  const bassButtons = buttonsInRole(instrument, 'bass')
  const chordButtons = buttonsInRole(instrument, 'chord')
  const noteStartChars = new Set(tune.notes.map((n) => n.startChar))
  const points: DisplayPoint[] = []

  tune.notes.forEach((note, i) => {
    const { target, label } = harmony[i]
    if (!target || !label) return
    const s = suggestions[i]
    points.push({
      startChar: note.startChar,
      startTicks: note.startTicks,
      name: label,
      bassText: s.bassLabel,
      chordText: s.chordLabel ? s.chordLabel.toLowerCase() : null,
      pull: s.direction === 'pull',
      barStart: i === 0 || tune.notes[i - 1].bar !== note.bar,
    })
  })

  for (const change of tune.chordChanges) {
    if (noteStartChars.has(change.startChar)) continue
    const direction = soundingDirection(tune, fingering, change.startTicks)
    const preferred = preferredDirection(instrument, change.chord)
    const silent = direction === null || (preferred !== null && direction !== preferred)
    let bassText: string | null = null
    let chordText: string | null = null
    if (!silent && direction) {
      const bestBass = bestButtonInDirection(bassButtons, direction, change.chord)
      const bestChord = bestButtonInDirection(chordButtons, direction, change.chord)
      bassText = bestBass ? bassLabelFor(bestBass.button, direction) : null
      const label = bestChord ? chordLabelFor(bestChord.button, direction) : null
      chordText = label ? label.toLowerCase() : null
    }
    points.push({
      startChar: change.startChar,
      startTicks: change.startTicks,
      name: change.symbol,
      bassText,
      chordText,
      pull: direction === 'pull',
      barStart: false,
    })
  }

  points.sort((a, b) => a.startTicks - b.startTicks)

  const chordNames: AccToken[] = []
  const bass: AccToken[] = []
  const chord: AccToken[] = []
  let lastName: string | undefined
  let lastBass: string | undefined
  let lastChord: string | undefined

  for (const point of points) {
    if (point.name !== lastName || point.barStart) {
      chordNames.push({ startChar: point.startChar, text: point.name, pull: false })
      lastName = point.name
    }
    if (point.bassText !== null) {
      const key = `${point.bassText}|${point.pull}`
      if (key !== lastBass || point.barStart) {
        bass.push({ startChar: point.startChar, text: point.bassText, pull: point.pull })
        lastBass = key
      }
    }
    if (point.chordText !== null) {
      const key = `${point.chordText}|${point.pull}`
      if (key !== lastChord || point.barStart) {
        chord.push({ startChar: point.startChar, text: point.chordText, pull: point.pull })
        lastChord = key
      }
    }
  }

  return { chordNames, bass, chord }
}
