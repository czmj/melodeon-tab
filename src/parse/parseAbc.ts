import { parseOnly } from 'abcjs'
import type { TuneObject } from 'abcjs'

export interface PrototypeNote {
  index: number
  writtenNames: string[]
  midiPitches: number[]
  durationWholeNotes: number
  bar: number
  startChar: number
  rest: boolean
}

export interface PrototypeBar {
  beforeNoteIndex: number
  type: string
  startEnding?: string
  endEnding?: boolean
}

export interface PrototypeTune {
  title: string
  key: string
  metre: string
  notes: PrototypeNote[]
  bars: PrototypeBar[]
  warnings: string[]
}

function keyLabel(tune: TuneObject): string {
  const k = tune.getKeySignature()
  const root = k.root as string | undefined
  if (!root || root === 'none') return ''
  const mode = k.mode === 'm' ? 'min' : k.mode || 'maj'
  return `${root}${mode}`
}

function metreLabel(tune: TuneObject): string {
  const m = tune.getMeterFraction()
  return `${m.num}/${m.den ?? 4}`
}

function audioPitchMap(tune: TuneObject): Map<number, number[]> {
  const map = new Map<number, number[]>()
  let audio
  try {
    audio = tune.setUpAudio({})
  } catch {
    return map
  }
  for (const track of audio.tracks) {
    for (const item of track) {
      if (item.cmd === 'note') {
        const list = map.get(item.startChar) ?? []
        if (!list.includes(item.pitch)) {
          list.push(item.pitch)
        }
        map.set(item.startChar, list)
      }
    }
  }
  return map
}

export function parseAbc(abc: string): PrototypeTune[] {
  const tunes: TuneObject[] = parseOnly(abc)
  return tunes.map((tune) => {
    const pitchMap = audioPitchMap(tune)
    const notes: PrototypeNote[] = []
    const bars: PrototypeBar[] = []
    let bar = 1
    let seenNoteInBar = false

    const items = tune.lines
      .flatMap((line) => line.staff ?? [])
      .flatMap((staff) => staff.voices ?? [])
      .flat()

    for (const item of items) {
      if (item.el_type === 'note') {
        const rest = item.rest !== undefined
        const pitches: Array<{ name?: string; endTie?: unknown }> = item.pitches ?? []
        const tiedFromPrevious =
          !rest && pitches.length > 0 && pitches.every((p) => p.endTie)
        if (tiedFromPrevious && notes.length > 0) {
          notes[notes.length - 1].durationWholeNotes += item.duration
        } else {
          notes.push({
            index: notes.length,
            writtenNames: rest ? ['z'] : pitches.map((p) => p.name ?? '?'),
            midiPitches: pitchMap.get(item.startChar) ?? [],
            durationWholeNotes: item.duration,
            bar,
            startChar: item.startChar,
            rest,
          })
        }
        seenNoteInBar = true
      } else if (item.el_type === 'bar') {
        bars.push({
          beforeNoteIndex: notes.length,
          type: item.type,
          startEnding: item.startEnding,
          endEnding: item.endEnding,
        })
        if (seenNoteInBar) {
          bar += 1
          seenNoteInBar = false
        }
      }
    }

    return {
      title: tune.metaText.title ?? '',
      key: keyLabel(tune),
      metre: metreLabel(tune),
      notes,
      bars,
      warnings: tune.warnings ?? [],
    }
  })
}
