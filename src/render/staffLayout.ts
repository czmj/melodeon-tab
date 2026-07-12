import type { StaffAnchor } from '../parse/renderStaff.ts'
import type { Candidate } from '../domain/instrument.ts'
import type { FingeringResult, NoteEvent, Tune } from '../domain/notes.ts'
import type { TabCell } from './tab.ts'

export interface NoteFingering {
  note: NoteEvent
  cell: TabCell
  options: Candidate[]
  chosen: Candidate | null
}

export interface FingeringInput {
  tune: Tune
  fingering: FingeringResult
  cells: TabCell[]
  lattice: Candidate[][]
}

export interface PositionedToken {
  startChar: number
  x: number
  y: number
  fingering: NoteFingering
}

export function aggregateByStartChar(inputs: FingeringInput[]): Map<number, NoteFingering> {
  const map = new Map<number, NoteFingering>()
  for (const input of inputs) {
    input.tune.notes.forEach((note, i) => {
      map.set(note.startChar, {
        note,
        cell: input.cells[i],
        options: input.lattice[i] ?? [],
        chosen: input.fingering.notes[i].chosen,
      })
    })
  }
  return map
}

export function placeTokens(
  anchors: StaffAnchor[],
  byStartChar: Map<number, NoteFingering>,
  offsetY: number,
): PositionedToken[] {
  const rowOf: number[] = []
  let row = 0
  let prevX = Infinity
  anchors.forEach((anchor, i) => {
    if (i > 0 && anchor.x < prevX) row += 1
    prevX = anchor.x
    rowOf.push(row)
  })

  const rowTop = new Map<number, number>()
  anchors.forEach((anchor, i) => {
    rowTop.set(rowOf[i], Math.min(rowTop.get(rowOf[i]) ?? Infinity, anchor.y))
  })

  const tokens: PositionedToken[] = []
  anchors.forEach((anchor, i) => {
    const fingering = byStartChar.get(anchor.startChar)
    if (!fingering || fingering.note.rest) return
    const top = rowTop.get(rowOf[i]) ?? anchor.y
    tokens.push({ startChar: anchor.startChar, x: anchor.x, y: top - offsetY, fingering })
  })
  return tokens
}
