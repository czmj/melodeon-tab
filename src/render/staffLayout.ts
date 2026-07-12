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

export interface PositionedLabel {
  startChar: number
  x: number
  y: number
  text: string
  pull: boolean
}

function rowIndices(anchors: StaffAnchor[]): number[] {
  const rowOf: number[] = []
  let row = 0
  let prevX = Infinity
  anchors.forEach((anchor, i) => {
    if (i > 0 && anchor.x < prevX) row += 1
    prevX = anchor.x
    rowOf.push(row)
  })
  return rowOf
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
  above = true,
): PositionedToken[] {
  const rowOf = rowIndices(anchors)

  const rowEdge = new Map<number, number>()
  anchors.forEach((anchor, i) => {
    const current = rowEdge.get(rowOf[i])
    rowEdge.set(
      rowOf[i],
      above
        ? Math.min(current ?? Infinity, anchor.y)
        : Math.max(current ?? -Infinity, anchor.y),
    )
  })

  const tokens: PositionedToken[] = []
  anchors.forEach((anchor, i) => {
    const fingering = byStartChar.get(anchor.startChar)
    if (!fingering || fingering.note.rest) return
    const edge = rowEdge.get(rowOf[i]) ?? anchor.y
    tokens.push({
      startChar: anchor.startChar,
      x: anchor.x,
      y: above ? edge - offsetY : edge + offsetY,
      fingering,
    })
  })
  return tokens
}

export function placeLabels(
  anchors: StaffAnchor[],
  byStartChar: Map<number, { text: string; pull: boolean }>,
  offsetY: number,
  above = false,
): PositionedLabel[] {
  const rowOf = rowIndices(anchors)

  const rowEdge = new Map<number, number>()
  anchors.forEach((anchor, i) => {
    const current = rowEdge.get(rowOf[i])
    rowEdge.set(
      rowOf[i],
      above
        ? Math.min(current ?? Infinity, anchor.y)
        : Math.max(current ?? -Infinity, anchor.y),
    )
  })

  const labels: PositionedLabel[] = []
  anchors.forEach((anchor, i) => {
    const entry = byStartChar.get(anchor.startChar)
    if (!entry) return
    const edge = rowEdge.get(rowOf[i]) ?? anchor.y
    labels.push({
      startChar: anchor.startChar,
      x: anchor.x,
      y: above ? edge - offsetY : edge + offsetY,
      ...entry,
    })
  })
  return labels
}
