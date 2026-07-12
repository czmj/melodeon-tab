import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Toaster } from '@/components/ui/sonner'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Candidate } from './domain/instrument.ts'
import { DG_STANDARD } from './domain/instrument.ts'
import type { Tune } from './domain/notes.ts'
import { mapTuneCandidates } from './engine/candidates.ts'
import { fingerWithConfidence } from './engine/confidence.ts'
import { makeCostFn } from './engine/cost.ts'
import moonAbc from './fixtures/moon-and-seven-stars.abc?raw'
import { parseAbc } from './parse/parseAbc.ts'
import type { FingeringInput } from './render/staffLayout.ts'
import { aggregateByStartChar } from './render/staffLayout.ts'
import { renderTab } from './render/tab.ts'
import { StaffTab } from './StaffTab.tsx'

export type Pins = Record<number, Candidate>

export const STORAGE_KEY = 'melodeon-tab-state'

export function isKnownCandidate(value: unknown): value is Candidate {
  if (typeof value !== 'object' || value === null) return false
  const direction = (value as { direction?: unknown }).direction
  const buttonId = (value as { buttonId?: unknown }).buttonId
  return (
    (direction === 'push' || direction === 'pull') &&
    DG_STANDARD.treble.buttons.some((b) => b.id === buttonId)
  )
}

function sameCandidate(a: Candidate, b: Candidate): boolean {
  return a.buttonId === b.buttonId && a.direction === b.direction
}

export function loadState(): { abc: string; pins: Pins } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const abc = typeof parsed?.abc === 'string' ? parsed.abc : moonAbc
      const pins: Pins = {}
      if (parsed?.pins && typeof parsed.pins === 'object') {
        for (const [key, value] of Object.entries(parsed.pins)) {
          if (isKnownCandidate(value)) pins[Number(key)] = value
        }
      }
      return { abc, pins }
    }
  } catch {
    return { abc: moonAbc, pins: {} }
  }
  return { abc: moonAbc, pins: {} }
}

export function App() {
  const initial = useMemo(loadState, [])
  const [abc, setAbc] = useState(initial.abc)
  const [pins, setPins] = useState<Pins>(initial.pins)
  const [selected, setSelected] = useState<number | null>(null)

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

  const fingeringInputs: (FingeringInput & { validPinStartChars: Set<number> })[] = useMemo(() => {
    const cost = makeCostFn(DG_STANDARD)
    return result.tunes
      .filter((tune) => tune.notes.length > 0)
      .map((tune) => {
        const lattice = mapTuneCandidates(tune, DG_STANDARD)
        const pinMap = new Map<number, Candidate>()
        const validPinStartChars = new Set<number>()
        tune.notes.forEach((n) => {
          const pin = pins[n.startChar]
          if (pin && (lattice[n.index] ?? []).some((c) => sameCandidate(c, pin))) {
            pinMap.set(n.index, pin)
            validPinStartChars.add(n.startChar)
          }
        })
        const fingering = fingerWithConfidence(tune, lattice, cost, pinMap)
        return {
          tune,
          fingering,
          cells: renderTab(fingering, DG_STANDARD),
          lattice,
          validPinStartChars,
        }
      })
  }, [result, pins])

  const byStartChar = useMemo(() => aggregateByStartChar(fingeringInputs), [fingeringInputs])

  useEffect(() => {
    const validStartChars = new Set<number>()
    fingeringInputs.forEach((input) =>
      input.validPinStartChars.forEach((sc) => validStartChars.add(sc)),
    )
    const stale = Object.keys(pins)
      .map(Number)
      .filter((sc) => !validStartChars.has(sc))
    if (stale.length === 0) return
    setPins((p) => {
      const next = { ...p }
      stale.forEach((sc) => delete next[sc])
      return next
    })
    toast('Overrides cleared', {
      description: 'Your edit shifted the notes they were pinned to, so those choices no longer applied.',
    })
  }, [fingeringInputs])

  const pinnedStartChars = useMemo(
    () => new Set(Object.keys(pins).map(Number)),
    [pins],
  )

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
    <div className="mx-auto flex min-h-screen max-w-[100rem] flex-col items-center gap-6 px-6 py-10">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-center text-2xl font-semibold">Melodeon Tab</h1>
          <p className="max-w-xl text-center text-sm text-muted-foreground">
            Edit the ABC notation below and it's turned into D/G melodeon tablature above the
            staff — button number, row, and bellows direction for every note. Click a note in the
            staff to override its suggested fingering.
          </p>
        </div>
        <Textarea
          value={abc}
          onChange={(e) => setAbc(e.target.value)}
          rows={16}
          className="w-full font-mono text-sm"
        />
        <div className="flex items-center gap-2 text-sm">
          <span>Overrides: {pinCount}</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pinCount === 0}
            onClick={() => setPins({})}
          >
            clear all overrides
          </Button>
        </div>
        {result.error && <p className="text-destructive">Parse error: {result.error}</p>}
      </div>
      <div className="w-full">
        <StaffTab
          abc={abc}
          byStartChar={byStartChar}
          onSelect={setSelected}
          selectedStartChar={selected}
          pinnedStartChars={pinnedStartChars}
          isPinned={selected !== null && pins[selected] !== undefined}
          onSetPin={(c) => selected !== null && setPin(selected, c)}
          onClearPin={() => selected !== null && clearPin(selected)}
        />
      </div>
      <Toaster />
    </div>
  )
}
