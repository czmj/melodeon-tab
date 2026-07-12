import { parseOnly } from 'abcjs'
import type { TuneObject } from 'abcjs'
import { PPWN, basicBeatStrength, wholeNotesToTicks } from '../domain/notes.ts'
import type { BarMarker, NoteEvent, Tune } from '../domain/notes.ts'

function keyLabel(tune: TuneObject): string {
  const k = tune.getKeySignature()
  const root = k.root as string | undefined
  if (!root || root === 'none') return ''
  const mode = k.mode === 'm' ? 'min' : k.mode || 'maj'
  return `${root}${mode}`
}

function metreTuple(tune: TuneObject): [number, number] {
  const m = tune.getMeterFraction()
  return [m.num, m.den ?? 4]
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

export function parseAbc(abc: string): Tune[] {
  const tunes: TuneObject[] = parseOnly(abc)
  return tunes.map((tune) => {
    const pitchMap = audioPitchMap(tune)
    const metre = metreTuple(tune)
    const notes: NoteEvent[] = []
    const bars: BarMarker[] = []
    let bar = 1
    let seenNoteInBar = false
    let startTicks = 0
    let barStartTicks = 0
    let pendingBoundary = true

    const items = tune.lines
      .flatMap((line) => line.staff ?? [])
      .flatMap((staff) => staff.voices ?? [])
      .flat()

    for (const item of items) {
      if (item.el_type === 'note') {
        const rest = item.rest !== undefined
        const pitches: Array<{ name?: string; endTie?: unknown }> = item.pitches ?? []
        const durationTicks = wholeNotesToTicks(item.duration)
        const tiedFromPrevious =
          !rest && pitches.length > 0 && pitches.every((p) => p.endTie)
        if (tiedFromPrevious && notes.length > 0) {
          const merged = notes[notes.length - 1]
          merged.durationTicks += durationTicks
          pendingBoundary = merged.durationTicks >= PPWN / 2
          startTicks += durationTicks
          seenNoteInBar = true
          continue
        }
        const midis = pitchMap.get(item.startChar) ?? []
        const writtenNames = pitches.map((p) => p.name ?? '?')
        notes.push({
          index: notes.length,
          pitch: rest || midis.length === 0 ? 0 : Math.max(...midis),
          writtenName: rest ? 'z' : writtenNames[writtenNames.length - 1] ?? '?',
          durationTicks,
          startTicks,
          bar,
          startChar: item.startChar,
          rest,
          collapsedChord: !rest && pitches.length > 1 ? true : undefined,
          beatStrength: basicBeatStrength(startTicks - barStartTicks, metre),
          phraseBoundaryBefore: pendingBoundary,
        })
        pendingBoundary = rest || durationTicks >= PPWN / 2
        startTicks += durationTicks
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
          barStartTicks = startTicks
          seenNoteInBar = false
        }
      }
    }

    return {
      title: tune.metaText.title ?? '',
      key: keyLabel(tune),
      metre,
      notes,
      bars,
    }
  })
}
