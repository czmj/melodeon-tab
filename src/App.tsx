import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { parseAbc } from './parse/parseAbc.ts'
import type { BarMarker, Tune } from './domain/notes.ts'
import { renderStaffNotation } from './parse/renderStaff.ts'
import { midiToName } from './domain/pitch.ts'
import moonAbc from './fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from './fixtures/jiggery-pokerwork.abc?raw'
import bansheeAbc from './fixtures/the-banshee.abc?raw'

const fixtures = [
  { name: 'The Moon And The Seven Stars', abc: moonAbc },
  { name: 'Jiggery Pokerwork', abc: jiggeryAbc },
  { name: 'The Banshee', abc: bansheeAbc },
]

function BarRow({ bar }: { bar: BarMarker }) {
  return (
    <tr>
      <td colSpan={6}>
        {bar.type}
        {bar.startEnding ? ` (ending ${bar.startEnding})` : ''}
        {bar.endEnding ? ' (end ending)' : ''}
      </td>
    </tr>
  )
}

function TuneView({ tune }: { tune: Tune }) {
  const barsBefore = useMemo(() => {
    const map = new Map<number, BarMarker[]>()
    for (const b of tune.bars) {
      const list = map.get(b.beforeNoteIndex) ?? []
      list.push(b)
      map.set(b.beforeNoteIndex, list)
    }
    return map
  }, [tune])

  return (
    <div>
      <h2>{tune.title || '(untitled)'}</h2>
      <p>
        Key: {tune.key} · Metre: {tune.metre[0]}/{tune.metre[1]} · Notes: {tune.notes.length}
      </p>
      <table border={1} cellPadding={4}>
        <thead>
          <tr>
            <th>#</th>
            <th>Bar</th>
            <th>Written</th>
            <th>Sounding (MIDI)</th>
            <th>Sounding (name)</th>
            <th>Duration (ticks)</th>
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
  const [abc, setAbc] = useState(fixtures[0].abc)
  const staffRef = useStaffNotation(abc)

  const result = useMemo(() => {
    try {
      return { tunes: parseAbc(abc), error: null as string | null }
    } catch (e) {
      return { tunes: [] as Tune[], error: String(e) }
    }
  }, [abc])

  return (
    <div>
      <h1>melodeon-tab — ABC parse prototype</h1>
      <p>
        {fixtures.map((f) => (
          <button key={f.name} type="button" onClick={() => setAbc(f.abc)}>
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
      <h2>Staff notation (reference)</h2>
      <div ref={staffRef} />
      {result.error && <p>Parse error: {result.error}</p>}
      {result.tunes
        .filter((tune) => tune.notes.length > 0)
        .map((tune, i) => (
          <TuneView key={i} tune={tune} />
        ))}
    </div>
  )
}
