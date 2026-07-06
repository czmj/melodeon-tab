import { candidatesForPitch } from '../domain/instrument.ts'
import type { Candidate, Instrument } from '../domain/instrument.ts'
import type { Tune } from '../domain/notes.ts'

export function mapTuneCandidates(tune: Tune, instrument: Instrument): Candidate[][] {
  return tune.notes.map((note) =>
    note.rest ? [] : candidatesForPitch(instrument, note.pitch),
  )
}
