import { useEffect, useRef, useState } from 'react'
import { renderStaffNotation } from './parse/renderStaff.ts'
import type { StaffAnchor } from './parse/renderStaff.ts'
import { placeLabels, placeTokens } from './render/staffLayout.ts'
import type { NoteFingering } from './render/staffLayout.ts'
import type { Candidate } from './domain/instrument.ts'
import { DG_STANDARD } from './domain/instrument.ts'
import { midiToName } from './domain/pitch.ts'
import { candidateLabel } from './render/tab.ts'
import { Button } from '@/components/ui/button'
import type { CSSProperties } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const TOKEN_OFFSET_Y = 34
const BASS_OFFSET_Y = 44
const CHORD_OFFSET_Y = 64

function candidateKey(c: Candidate): string {
  return `${c.buttonId}-${c.direction}`
}

export function StaffTab({
  abc,
  byStartChar,
  bassByStartChar,
  chordByStartChar,
  onSelect,
  selectedStartChar,
  pinnedStartChars,
  isPinned,
  onSetPin,
  onClearPin,
}: {
  abc: string
  byStartChar: Map<number, NoteFingering>
  bassByStartChar: Map<number, { text: string; pull: boolean }>
  chordByStartChar: Map<number, { text: string; pull: boolean }>
  onSelect: (startChar: number | null) => void
  selectedStartChar: number | null
  pinnedStartChars: Set<number>
  isPinned: boolean
  onSetPin: (candidate: Candidate) => void
  onClearPin: () => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const staffRef = useRef<HTMLDivElement>(null)
  const [anchors, setAnchors] = useState<StaffAnchor[]>([])

  useEffect(() => {
    const wrapper = wrapperRef.current
    const staff = staffRef.current
    if (!wrapper || !staff) return
    const render = () => setAnchors(renderStaffNotation(staff, abc, wrapper.clientWidth))
    render()
    const observer = new ResizeObserver(render)
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [abc])

  const tokens = placeTokens(anchors, byStartChar, TOKEN_OFFSET_Y)
  const bassLabels = placeLabels(anchors, bassByStartChar, BASS_OFFSET_Y)
  const chordLabels = placeLabels(anchors, chordByStartChar, CHORD_OFFSET_Y)

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <div ref={staffRef} />
      {bassLabels.map((label) => (
        <span
          key={`bass-${label.startChar}`}
          className="absolute -translate-x-1/2 inline-flex h-5 items-center justify-center px-1 text-xs font-semibold"
          style={{ left: label.x, top: label.y, textDecoration: label.pull ? 'underline' : undefined }}
        >
          {label.text}
        </span>
      ))}
      {chordLabels.map((label) => (
        <span
          key={`chord-${label.startChar}`}
          className="absolute -translate-x-1/2 inline-flex h-5 items-center justify-center px-1 text-xs italic text-muted-foreground"
          style={{ left: label.x, top: label.y, textDecoration: label.pull ? 'underline' : undefined }}
        >
          {label.text}
        </span>
      ))}
      {tokens.map((token) => {
        const { cell, note, options, chosen } = token.fingering
        const isOpen = selectedStartChar === token.startChar
        const value = isPinned && chosen ? candidateKey(chosen) : 'auto'
        const hasChoice = options.length > 1

        const dynamicStyle: CSSProperties = {
          left: token.x,
          top: token.y,
          textDecoration: cell.pull ? 'underline' : undefined,
          fontWeight: pinnedStartChars.has(token.startChar) ? 'bold' : undefined,
        }

        const chordCollapsed = note.collapsedChord === true
        const cellText = chordCollapsed ? `${cell.text}*` : cell.text
        const titleParts: string[] = []
        if (options.length === 0) titleParts.push('unplayable (rest or diatonic gap)')
        if (chordCollapsed) titleParts.push(`chord collapsed to top note (${midiToName(note.pitch)})`)
        const title = titleParts.length > 0 ? titleParts.join(' — ') : undefined

        if (!hasChoice) {
          return (
            <span
              key={token.startChar}
              title={title}
              className="absolute -translate-x-1/2 inline-flex h-6 items-center justify-center px-2 text-xs"
              style={dynamicStyle}
            >
              {cellText}
            </span>
          )
        }

        return (
          <DropdownMenu
            key={token.startChar}
            open={isOpen}
            onOpenChange={(open) => onSelect(open ? token.startChar : null)}
          >
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  className="absolute -translate-x-1/2"
                  style={dynamicStyle}
                  title={title}
                >
                  {cellText}
                </Button>
              }
            />
            <DropdownMenuContent align="center" className="w-64">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  {note.rest ? 'Rest' : midiToName(note.pitch)}
                  {chordCollapsed ? ' (chord collapsed to this note)' : ''}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={value}
                  onValueChange={(next) => {
                    if (next === 'auto') {
                      onClearPin()
                      return
                    }
                    const candidate = options.find((c) => candidateKey(c) === next)
                    if (candidate) onSetPin(candidate)
                  }}
                >
                  <DropdownMenuRadioItem value="auto">Auto</DropdownMenuRadioItem>
                  {options.map((c) => (
                    <DropdownMenuRadioItem key={candidateKey(c)} value={candidateKey(c)}>
                      {candidateLabel(DG_STANDARD, c)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}
