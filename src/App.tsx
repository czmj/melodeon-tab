import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { parseAbc } from './parse/parseAbc.ts'
import type { BarMarker, NoteEvent, Tune } from './domain/notes.ts'
import type { Candidate } from './domain/instrument.ts'
import { renderStaffNotation } from './parse/renderStaff.ts'
import { DG_STANDARD, candidatesForPitch } from './domain/instrument.ts'
import { mapTuneCandidates } from './engine/candidates.ts'
import { fingerWithConfidence } from './engine/confidence.ts'
import { makeCostFn } from './engine/cost.ts'
import { renderTab } from './render/tab.ts'
import { midiToName } from './domain/pitch.ts'
import moonAbc from './fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from './fixtures/jiggery-pokerwork.abc?raw'
import bansheeAbc from './fixtures/the-banshee.abc?raw'

const fixtures = [
  { name: 'The Moon And The Seven Stars', abc: moonAbc },
  { name: 'Jiggery Pokerwork', abc: jiggeryAbc },
  { name: 'The Banshee', abc: bansheeAbc },
]

type Pins = Record<number, Candidate>

const STORAGE_KEY = 'melodeon-tab-state'

function isKnownCandidate(value: unknown): value is Candidate {
  if (typeof value !== 'object' || value === null) return false
  const direction = (value as { direction?: unknown }).direction
  const buttonId = (value as { buttonId?: unknown }).buttonId
  return (
    (direction === 'push' || direction === 'pull') &&
    DG_STANDARD.treble.buttons.some((b) => b.id === buttonId)
  )
}

function loadState(): { abc: string; pins: Pins } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const abc = typeof parsed?.abc === 'string' ? parsed.abc : fixtures[0].abc
      const pins: Pins = {}
      if (parsed?.pins && typeof parsed.pins === 'object') {
        for (const [key, value] of Object.entries(parsed.pins)) {
          if (isKnownCandidate(value)) pins[Number(key)] = value
        }
      }
      return { abc, pins }
    }
  } catch {
    return { abc: fixtures[0].abc, pins: {} }
  }
  return { abc: fixtures[0].abc, pins: {} }
}

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

function pinLabel(c: Candidate): string {
  return `${c.buttonId} ${c.direction === 'push' ? '↑' : '↓'}`
}

function candidateLabel(note: NoteEvent): string {
  if (note.rest) return '—'
  const candidates = candidatesForPitch(DG_STANDARD, note.pitch)
  if (candidates.length === 0) return '— unplayable'
  return candidates.map((c) => `${c.buttonId} ${c.direction}`).join(', ')
}

function BarRow({ bar }: { bar: BarMarker }) {
  return (
    <tr>
      <td colSpan={7}>
        {bar.type}
        {bar.startEnding ? ` (ending ${bar.startEnding})` : ''}
        {bar.endEnding ? ' (end ending)' : ''}
      </td>
    </tr>
  )
}

function OverridePanel({
  noteIndex,
  note,
  options,
  chosen,
  pinned,
  onSetPin,
  onClearPin,
  onClose,
}: {
  noteIndex: number
  note: NoteEvent
  options: Candidate[]
  chosen: Candidate | null
  pinned: Candidate | undefined
  onSetPin: (candidate: Candidate) => void
  onClearPin: () => void
  onClose: () => void
}) {
  return (
    <div>
      <strong>Note {noteIndex}</strong>{' '}
      ({note.rest ? 'rest' : `${note.writtenName} = ${midiToName(note.pitch)}`}):{' '}
      {options.length === 0 ? (
        <em>no playable buttons (rest or diatonic gap)</em>
      ) : (
        options.map((c, ci) => {
          const isPinned = pinned !== undefined && sameCandidate(c, pinned)
          const isAuto = chosen !== null && sameCandidate(c, chosen)
          return (
            <button key={ci} type="button" disabled={isPinned} onClick={() => onSetPin(c)}>
              {pinLabel(c)}
              {isPinned ? ' ✓ pinned' : isAuto ? ' (auto)' : ''}
            </button>
          )
        })
      )}{' '}
      {pinned !== undefined && (
        <button type="button" onClick={onClearPin}>
          clear override
        </button>
      )}{' '}
      <button type="button" onClick={onClose}>
        close
      </button>
    </div>
  )
}

function TuneView({
  tune,
  pins,
  onSetPin,
  onClearPin,
}: {
  tune: Tune
  pins: Pins
  onSetPin: (startChar: number, candidate: Candidate) => void
  onClearPin: (startChar: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)

  const barsBefore = useMemo(() => {
    const map = new Map<number, BarMarker[]>()
    for (const b of tune.bars) {
      const list = map.get(b.beforeNoteIndex) ?? []
      list.push(b)
      map.set(b.beforeNoteIndex, list)
    }
    return map
  }, [tune])

  const lattice = useMemo(() => mapTuneCandidates(tune, DG_STANDARD), [tune])

  const fingering = useMemo(() => {
    const pinMap = new Map<number, Candidate>()
    tune.notes.forEach((n) => {
      const pin = pins[n.startChar]
      if (pin) pinMap.set(n.index, pin)
    })
    return fingerWithConfidence(tune, lattice, makeCostFn(DG_STANDARD), pinMap)
  }, [tune, lattice, pins])

  const tab = useMemo(() => renderTab(fingering, DG_STANDARD), [fingering])

  const selectedNote = selected !== null ? tune.notes[selected] : null

  return (
    <div>
      <h2>{tune.title || '(untitled)'}</h2>
      <p>
        Key: {tune.key} · Metre: {tune.metre[0]}/{tune.metre[1]} · Notes: {tune.notes.length}
      </p>
      <h3>
        Tab (click a note to override — <span style={{ color: 'red' }}>↑ push</span>,{' '}
        <span style={{ color: 'blue' }}>↓ pull</span>, <u>underline</u> = G row, ? =
        unplayable, - = rest, <strong>bold</strong> = pinned,{' '}
        <span style={{ backgroundColor: '#ffe08a' }}>highlight</span> = low-confidence)
      </h3>
      <pre>
        {tab.map((cell, i) => {
          const barBreak = i > 0 && tune.notes[i].bar !== tune.notes[i - 1].bar
          const isPinned = pins[tune.notes[i].startChar] !== undefined
          return (
            <Fragment key={i}>
              {barBreak ? '| ' : ''}
              <span
                onClick={() => setSelected(i)}
                title={cell.lowConfidence ? 'low confidence — close call' : undefined}
                style={{
                  color: cell.colour ?? undefined,
                  textDecoration: cell.underline ? 'underline' : undefined,
                  cursor: 'pointer',
                  fontWeight: isPinned ? 'bold' : undefined,
                  backgroundColor: cell.lowConfidence ? '#ffe08a' : undefined,
                  outline:
                    selected === i
                      ? '1px solid black'
                      : isPinned
                        ? '1px dotted grey'
                        : undefined,
                }}
              >
                {cell.text}
                {cell.arrow}
              </span>{' '}
            </Fragment>
          )
        })}
      </pre>
      {selected !== null && selectedNote && (
        <OverridePanel
          noteIndex={selected}
          note={selectedNote}
          options={lattice[selected] ?? []}
          chosen={fingering.notes[selected].chosen}
          pinned={pins[selectedNote.startChar]}
          onSetPin={(c) => onSetPin(selectedNote.startChar, c)}
          onClearPin={() => onClearPin(selectedNote.startChar)}
          onClose={() => setSelected(null)}
        />
      )}
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>#</th>
            <th>Bar</th>
            <th>Written</th>
            <th>Sounding (MIDI)</th>
            <th>Sounding (name)</th>
            <th>Duration (ticks)</th>
            <th>Buttons (D/G)</th>
          </tr>
        </thead>
        <tbody>
          {tune.notes.map((n) => (
            <Fragment key={n.index}>
              {barsBefore.get(n.index)?.map((b, i) => (
                <BarRow key={`bar-${n.index}-${i}`} bar={b} />
              ))}
              <tr>
                <td>{n.index}</td>
                <td>{n.bar}</td>
                <td>
                  {n.writtenName}
                  {n.flattenedChord ? ' (chord→top)' : ''}
                </td>
                <td>{n.rest ? '—' : n.pitch}</td>
                <td>{n.rest ? 'rest' : midiToName(n.pitch)}</td>
                <td>{n.durationTicks}</td>
                <td>{candidateLabel(n)}</td>
              </tr>
            </Fragment>
          ))}
          {barsBefore.get(tune.notes.length)?.map((b, i) => (
            <BarRow key={`bar-end-${i}`} bar={b} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function useStaffNotation(abc: string) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      renderStaffNotation(ref.current, abc)
    }
  }, [abc])
  return ref
}

export function App() {
  const initial = useMemo(loadState, [])
  const [abc, setAbc] = useState(initial.abc)
  const [pins, setPins] = useState<Pins>(initial.pins)
  const staffRef = useStaffNotation(abc)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ abc, pins }))
    } catch {
      return
    }
  }, [abc, pins])

  const result = useMemo(() => {
    try {
      return { tunes: parseAbc(abc), error: null as string | null }
    } catch (e) {
      return { tunes: [] as Tune[], error: String(e) }
    }
  }, [abc])

  const loadFixture = (fixtureAbc: string) => {
    setAbc(fixtureAbc)
    setPins({})
  }

  const setPin = (startChar: number, candidate: Candidate) =>
    setPins((p) => ({ ...p, [startChar]: candidate }))

  const clearPin = (startChar: number) =>
    setPins((p) => {
      const next = { ...p }
      delete next[startChar]
      return next
    })

  const pinCount = Object.keys(pins).length

  return (
    <div>
      <h1>melodeon-tab — ABC parse prototype</h1>
      <p>
        {fixtures.map((f) => (
          <button key={f.name} type="button" onClick={() => loadFixture(f.abc)}>
            {f.name}
          </button>
        ))}
      </p>
      <textarea
        value={abc}
        onChange={(e) => setAbc(e.target.value)}
        rows={16}
        cols={80}
      />
      <p>
        Overrides: {pinCount}{' '}
        <button type="button" disabled={pinCount === 0} onClick={() => setPins({})}>
          clear all overrides
        </button>
      </p>
      <h2>Staff notation (reference)</h2>
      <div ref={staffRef} />
      {result.error && <p>Parse error: {result.error}</p>}
      {result.tunes
        .filter((tune) => tune.notes.length > 0)
        .map((tune, i) => (
          <TuneView
            key={i}
            tune={tune}
            pins={pins}
            onSetPin={setPin}
            onClearPin={clearPin}
          />
        ))}
    </div>
  )
}
