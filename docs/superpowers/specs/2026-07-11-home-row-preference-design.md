# Home-row preference — design

Give the cost function a pull toward the row that's diatonically "home" for the tune's key, so a
tune in G mostly plays the G row and a tune in D mostly plays the D row — not just avoid
*changing* row, which is all `rowChange` currently does.

## Goal

Today `cost()` only penalises a row change between two consecutive notes; it has no notion of a
row being the "right" one for the tune as a whole. Two fingerings that are locally equally cheap
(same number of row changes) can currently come out tied even when one of them idiomatically
lives on the tune's home row and the other doesn't. Add a term that breaks that tie in favour of
the home row, reusably across any diatonic layout (not hardcoded to D/G).

## Scope

In:
- Instrument schema: attach a home key to each row, as data (Invariant 1).
- A pitch-class-based key-matching helper for **major keys only** — see Decision 3, revised.
- A new `CostWeights` term, applied per-candidate in `cost()`.
- Wiring `tune.key` through to the cost function (see Decision 3 — this is the one place that
  isn't a pure additive change).
- Unit tests for the key-matching helper and the new cost term; an empirical fixture check
  (row-usage stats before/after) matching how `air`/`rowChange` tuning was verified.

Out (this pass):
- Deriving a row's home key by analysing its pitch content. Rejected outright — see Decision 1.
- **Any row preference for minor (or modal) keys — disproven, not just deferred.** See Decision 3.
  A minor tune gets no `offHomeRow` term at all; only major keys get the nudge.
- Mid-tune key changes. `Tune.key` is one value per tune already (same limitation as the `Tune.metre`
  case found via the Tansys Golowan fixture) — not a new problem, not fixed here.
- Bass end / chord-driven row preference (post-MVP, no bass end yet).
- Actually tuning the new weight's magnitude — that's a hand-tuning pass against fixtures once
  it's wired up, same as `airPenaltyRate`/`airComfortBeats`/`rowChange` were.
- A three-row instrument instance, or adding a real accidental half-row to `DG_STANDARD`. This
  spec makes the schema capable of representing either; populating one with real button/pitch data
  is separate work needing hardware verification, same caveat `DG_STANDARD`'s own pitch map already
  carries.

## Decisions

1. **Home key is explicit per-row data, not derived from pitch content.** A row's diatonic pitch
   set could in principle be scale-matched to infer its root, but that's fragile (row-top
   accidental buttons could throw a naive matcher off) and unnecessary — the layout author already
   knows the row's key when writing the button data, same as they already know every button's
   pitches. This is also the direct answer to "how do we know the third row's root on an ADG box":
   we don't derive it, we declare it, exactly like a fourth or fifth row would be — the mechanism
   doesn't care how many rows exist.

2. **`Row.homeKey` is optional — accidental half-rows have none.** Many D/G boxes carry a half
   row of accidental buttons (a handful of chromatic notes outside both main rows) alongside the
   two diatonic rows. That row isn't "home" to any key — nobody plays a tune mostly on the
   accidental buttons, they exist to patch in the odd note a diatonic row can't reach. Modelling it
   as a `Row` with `homeKey: undefined` needs no special-casing elsewhere: it simply never matches
   any tune's target pitch class, so it never gets the home-row bonus — same treatment as any other
   non-home row, which is the right outcome (prefer a main row when one covers the note; fall back
   to the accidental row when nothing else does, exactly as today, since `mapTuneCandidates` still
   offers it as a candidate regardless of this term).

3. **Minor keys get no row preference at all — the relative-major rule is disproven, not just
   uncertain.** The original plan was "minor → relative major's row" (`Emin` → G). Checked against
   a real counter-example: "Bear Dance" (`K:Em`) — the player's actual preference is the D row, not
   G. Its sounding pitch classes are `{A, B, D, E, F#, G}` (verified by running it through
   `parseAbc`) — no C or C# anywhere, which is exactly the note D major and G major *don't* share,
   so the tune is fully playable on either row from pitch content alone. The row choice here is a
   real idiomatic/ergonomic call (which push-pull pattern suits this specific melody's contour and
   rhythm) that a static key→row rule can't derive — theory said G, the player says D, and nothing
   about the note content adjudicates between them. Rather than encode a rule known to be
   sometimes-wrong, apply `offHomeRow` **only when the tune's key is unambiguously major**; minor
   (and modal) keys pass no target pitch class, so the term never fires and today's behaviour
   (row-change cost only) is unchanged. Revisit if a genuinely reliable minor-key signal turns up —
   this isn't "come back and finish it", it's "the simple version of this doesn't exist".

4. **Cost function needs to become tune-scoped, not just instrument-scoped.** `makeCostFn(instrument,
   weights)` is currently created once and reused across every tune in the textarea (`App.tsx`
   calls it once, outside the per-tune `.map()`). Home-row preference depends on `tune.key`, which
   varies per tune, so the cost function must be (re)built per tune — `makeCostFn(instrument,
   weights, homeKeyPitchClass)`, called once per tune inside the existing per-tune loop, right next
   to where `mapTuneCandidates`/`fingerWithConfidence` already are. This is the one change here
   that isn't purely additive to the engine; it also touches the `App.tsx` call site.

## Architecture

### `domain/instrument.ts`

```ts
export interface Row {
  index: number
  homeKey?: string  // e.g. 'D', 'G' — plain letter, natural. Absent for an accidental half-row.
}

export interface Keyboard {
  buttons: Button[]
  rows: Row[]
}
```

`DG_STANDARD.treble.rows` becomes `[{ index: 0, homeKey: 'D' }, { index: 1, homeKey: 'G' }]` (this
particular 21-button layout has no accidental row modelled — see Scope). A box that does would add
a third `Row` with `homeKey` omitted. `resolveCandidate` already returns `row: number` (the
button's row index); a new small helper looks up that index's `Row` and returns its `homeKey`
(possibly `undefined`).

### `domain/pitch.ts`

```ts
// Extends the existing midiToName table with the reverse direction.
export function pitchClassOf(noteName: string): number  // 'D' -> 2, 'Bb' -> 10, 'F#' -> 6, …

// tune.key is 'Xmaj' | 'Xmin' | other (modal codes abcjs may emit). Returns the tonic's pitch
// class for major keys only; null for minor and everything else (Decision 3 — no reliable
// row-preference signal for non-major keys, so no target is passed and the term never fires).
export function homeKeyPitchClass(tuneKey: string): number | null
```

### `engine/cost.ts`

```ts
export interface CostWeights {
  // …existing…
  offHomeRow: number
}

export function makeCostFn(
  instrument: Instrument,
  weights: CostWeights = DEFAULT_WEIGHTS,
  homeKeyPitchClass: number | null = null,
): CostFn
```

Inside the returned function, alongside the existing row-change check: resolve `to`'s row's
`homeKey`. If `homeKeyPitchClass` is `null` (no target, or unrecognised mode), skip the term
entirely — today's behaviour, unchanged. Otherwise add `weights.offHomeRow` unless the row's
`homeKey` is present *and* its pitch class matches — so an accidental row with no `homeKey` always
takes the penalty (Decision 2), same as any other non-matching row.

### `App.tsx`

`const cost = makeCostFn(DG_STANDARD)` (created once, outside the per-tune loop) moves inside the
`result.tunes.map(...)` in the `byStartChar` memo, becoming `makeCostFn(DG_STANDARD, DEFAULT_WEIGHTS,
homeKeyPitchClass(tune.key))` — one cost function per tune, matching where `mapTuneCandidates`
already is.

## Edge cases

- **No row matches the tune's key** (e.g. a C major tune on a D/G box — C is home to neither row):
  `offHomeRow` applies equally to every candidate, so it nets out to no preference — identical to
  today's behaviour. Not a regression.
- **Accidental half-row** (`Row.homeKey` absent): always takes `offHomeRow`, for every tune key.
  Correct — it should only ever be chosen when it's the only (or cheapest-overall) option, never
  preferred over a main row for idiomatic reasons. See Decision 2.
- **Minor or unrecognised mode** (`Emin`, Dorian, Mixolydian, …): `homeKeyPitchClass` returns
  `null` for all of these (Decision 3), `makeCostFn` gets `null`, term is skipped entirely.
- **Mid-tune key change:** not tracked (single `Tune.key`, pre-existing limitation, same shape as
  the metre issue already flagged in the roadmap).

## Testing

- `pitchClassOf`: covers naturals, sharps, flats, enharmonic pairs.
- `homeKeyPitchClass`: major passthrough; minor and unrecognised modes both → `null`.
- `cost()`: candidate on the home row → no added cost; off home row → `offHomeRow` added;
  `homeKeyPitchClass: null` → term never fires (backward-compatible default).
- Fixture check: row-usage ratio (D-row vs G-row candidate count in the chosen fingering) per
  fixture, before/after, same style as the earlier reversal-count comparison — to sanity-check the
  effect is real and in the right direction before hand-tuning `offHomeRow`'s magnitude.

## Invariants

- Row semantics stay entirely in instrument data (`Row.homeKey`) — the engine never hardcodes
  which row belongs to which key (Invariant 1).
- `cost()` remains the single place musical judgement lives; `computeFingering`'s DP still only
  reads through it (Invariant 3 / ADR 0003).
