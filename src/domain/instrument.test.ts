import { describe, expect, it } from 'vitest'
import { DG_STANDARD, buttonsInRole, candidatesForPitch, resolveCandidate } from './instrument.ts'

describe('DG_STANDARD', () => {
  it('has 21 treble buttons and an 8-button bass end', () => {
    expect(DG_STANDARD.treble.buttons).toHaveLength(21)
    expect(DG_STANDARD.bass.buttons).toHaveLength(8)
  })

  it('finds every candidate that sounds D4 = 62 (a cross-row reversal)', () => {
    expect(candidatesForPitch(DG_STANDARD, 62)).toEqual([
      { buttonId: 'd3', direction: 'push' },
      { buttonId: 'g1', direction: 'pull' },
      { buttonId: 'g2', direction: 'push' },
    ])
  })

  it('returns an empty array for a diatonic gap (C natural = 60)', () => {
    expect(candidatesForPitch(DG_STANDARD, 60)).toEqual([])
  })

  it('resolves a candidate to its button, row, position and sounding pitch', () => {
    const r = resolveCandidate(DG_STANDARD, { buttonId: 'd3', direction: 'push' })
    expect(r.row).toBe(0)
    expect(r.outside).toBe(false)
    expect(r.position).toBe(3)
    expect(r.pitch).toBe(62)
  })

  it('flags the G row as outside and the D row as inside', () => {
    expect(resolveCandidate(DG_STANDARD, { buttonId: 'd1', direction: 'push' }).outside).toBe(false)
    expect(resolveCandidate(DG_STANDARD, { buttonId: 'g1', direction: 'push' }).outside).toBe(true)
  })
})

describe('DG_STANDARD bass end', () => {
  const bass = DG_STANDARD.bass.buttons
  const pcs = (pitches: number[]): Set<number> => new Set(pitches.map((p) => p % 12))
  const eq = (a: Set<number>, b: Set<number>): boolean =>
    a.size === b.size && [...a].every((x) => b.has(x))

  const chordButtons = bass.filter((b) => b.role === 'chord')
  const bassButtons = bass.filter((b) => b.role === 'bass')

  const chordSoundsIn = (dir: 'push' | 'pull', target: Set<number>): boolean =>
    chordButtons.some((b) => eq(pcs(dir === 'push' ? b.push : b.pull), target))
  const bassRootsIn = (dir: 'push' | 'pull'): Set<number> =>
    new Set(bassButtons.map((b) => (dir === 'push' ? b.push[0] : b.pull[0]) % 12))

  const D_MAJ = new Set([2, 6, 9])
  const A_MAJ = new Set([9, 1, 4])
  const G_MAJ = new Set([7, 11, 2])
  const C_MAJ = new Set([0, 4, 7])
  const E_MIN = new Set([4, 7, 11])
  const B_MAJ = new Set([11, 3, 6])

  it('splits into four bass buttons and four chord buttons', () => {
    expect(bassButtons).toHaveLength(4)
    expect(chordButtons).toHaveLength(4)
  })

  it('chord buttons are triads (thirds present on this box), bass buttons single notes', () => {
    expect(chordButtons.every((b) => b.push.length === 3 && b.pull.length === 3)).toBe(true)
    expect(bassButtons.every((b) => b.push.length === 1 && b.pull.length === 1)).toBe(true)
  })

  it('offers D and C major chords in both bellows directions', () => {
    expect(chordSoundsIn('push', D_MAJ)).toBe(true)
    expect(chordSoundsIn('pull', D_MAJ)).toBe(true)
    expect(chordSoundsIn('push', C_MAJ)).toBe(true)
    expect(chordSoundsIn('pull', C_MAJ)).toBe(true)
  })

  it('offers G major on push only and A major on pull only', () => {
    expect(chordSoundsIn('push', G_MAJ)).toBe(true)
    expect(chordSoundsIn('pull', G_MAJ)).toBe(false)
    expect(chordSoundsIn('pull', A_MAJ)).toBe(true)
    expect(chordSoundsIn('push', A_MAJ)).toBe(false)
  })

  it('offers E minor (on pull) and B major (on push)', () => {
    expect(chordSoundsIn('pull', E_MIN)).toBe(true)
    expect(chordSoundsIn('push', B_MAJ)).toBe(true)
  })

  it('has bass roots matching the chart: push D/B/G/C, pull A/E/D/C', () => {
    expect(eq(bassRootsIn('push'), new Set([2, 11, 7, 0]))).toBe(true)
    expect(eq(bassRootsIn('pull'), new Set([9, 4, 2, 0]))).toBe(true)
  })
})

describe('resolveCandidate across both keyboards', () => {
  it('resolves a bass-end button, exposing its role and full pitch list', () => {
    const chord = resolveCandidate(DG_STANDARD, { buttonId: 'chord1', direction: 'push' })
    expect(chord.role).toBe('chord')
    expect(chord.pitches).toEqual([50, 54, 57])

    const bass = resolveCandidate(DG_STANDARD, { buttonId: 'bass1', direction: 'pull' })
    expect(bass.role).toBe('bass')
    expect(bass.pitches).toEqual([45])
  })

  it('still resolves a treble button, whose role is undefined', () => {
    const r = resolveCandidate(DG_STANDARD, { buttonId: 'd3', direction: 'push' })
    expect(r.role).toBeUndefined()
    expect(r.pitch).toBe(62)
  })

  it('buttonsInRole splits the bass end into four bass and four chord buttons', () => {
    expect(buttonsInRole(DG_STANDARD, 'bass')).toHaveLength(4)
    expect(buttonsInRole(DG_STANDARD, 'chord')).toHaveLength(4)
  })
})
