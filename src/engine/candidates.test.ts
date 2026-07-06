import { describe, expect, it } from 'vitest'
import { parseAbc } from '../parse/parseAbc.ts'
import { DG_STANDARD } from '../domain/instrument.ts'
import { mapTuneCandidates } from './candidates.ts'
import moonAbc from '../fixtures/moon-and-seven-stars.abc?raw'
import jiggeryAbc from '../fixtures/jiggery-pokerwork.abc?raw'

describe('mapTuneCandidates', () => {
  it('returns one candidate list per note, aligned with tune.notes', () => {
    const [tune] = parseAbc(moonAbc)
    const cands = mapTuneCandidates(tune, DG_STANDARD)
    expect(cands.length).toBe(tune.notes.length)
  })

  it('maps a playable note to its (button, direction) options', () => {
    const [tune] = parseAbc(moonAbc)
    const cands = mapTuneCandidates(tune, DG_STANDARD)
    expect(cands[0]).toEqual([
      { buttonId: 'd6', direction: 'push' },
      { buttonId: 'g5', direction: 'push' },
    ])
  })

  it('finds every note in a D major tune playable', () => {
    const [tune] = parseAbc(moonAbc)
    const cands = mapTuneCandidates(tune, DG_STANDARD)
    tune.notes.forEach((note, i) => {
      if (!note.rest) expect(cands[i].length).toBeGreaterThan(0)
    })
  })

  it('surfaces a diatonic gap: A# (^A) is unplayable on a D/G box', () => {
    const [tune] = parseAbc(jiggeryAbc)
    const cands = mapTuneCandidates(tune, DG_STANDARD)
    const i = tune.notes.findIndex((n) => n.writtenName === '^A')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(tune.notes[i].rest).toBe(false)
    expect(cands[i]).toEqual([])
  })

  it('gives rests an empty candidate list', () => {
    const [tune] = parseAbc('X:1\nL:1/8\nK:D\nD z E|')
    const cands = mapTuneCandidates(tune, DG_STANDARD)
    expect(cands.length).toBe(3)
    expect(tune.notes[1].rest).toBe(true)
    expect(cands[1]).toEqual([])
    expect(cands[0].length).toBeGreaterThan(0)
  })
})
