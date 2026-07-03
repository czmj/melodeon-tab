# abcjs spike — findings

Roadmap step 1. Fed three real session tunes (`src/fixtures/*.abc`: Moon And The Seven
Stars, Jiggery Pokerwork, The Banshee) through `abcjs@6.6.3` and probed its parsed
structure. Run with `NODE_PATH=./node_modules node <script>.cjs` (abcjs is CommonJS).

Findings below were cross-checked against the official docs (docs.abcjs.net) and the
paulrosen/abcjs examples via context7 — see "Verification against official docs" at the end.

## What abcjs gives us

Two complementary outputs from the same parse:

### `abcjs.parseOnly(abc)` — written structure
Returns an array of tune objects. Musical content is at
`tune.lines[].staff[].voices[][]`, a flat list of elements:

- **Notes**: `{ el_type:'note', duration, pitches:[{ pitch, name, accidental? }], startChar, endChar }`
  - `pitch` is a **diatonic staff step, C=0, 7 per octave** (`D=1 E=2 … B=6 c=7 … a=12`).
    It is the *written line/space position only*.
  - **Key signature is NOT applied**: in D major every `F` comes back `name:'F'` with no
    accidental, though it sounds F♯.
  - **Explicit accidentals only** appear as `accidental:'sharp'|'natural'|…` and in `name`
    (`^A`, `=A`). **Within-bar carry is NOT propagated**: `A ^A A A` returns the trailing
    two A's plain, not sharp.
  - Ornaments are separate: `~f` → `decoration:['irishroll']`; grace `{ge}` → `gracenotes[]`
    on the following note. Neither pollutes the pitch.
- **Bars**: `{ el_type:'bar', type }` with `type` ∈ `bar_thin`, `bar_left_repeat`,
  `bar_right_repeat`, `bar_thin_thick`, … Variant endings appear as `startEnding:1|2` +
  `endEnding` flags on bar elements. So repeat structure is fully recoverable.
- Ties surface as `startTie`/`endTie` flags (none in the fixtures).

### `tune.setUpAudio({})` — resolved sounding pitch
Returns `{ tempo, instrument, tracks, totalDuration }`. Flattening `tracks` and keeping
`cmd:'note'` gives events `{ pitch, start, duration, startChar, endChar }` where **`pitch`
is absolute MIDI, fully resolved** by abcjs's own playback engine:

- Key signature applied (`K:D` `F` → 66 = F♯4).
- Explicit accidentals applied.
- **Within-bar accidental carry applied and reset at the barline**
  (`A ^A A A | A` → `69 70 70 70 | 69`; `^A =A A` → `70 69 69`).

Its `startChar` matches `parseOnly`'s `startChar` for the same note.

## Consequence for the adapter

**Do not reimplement music theory.** Join the two representations on `startChar`:

- `parseOnly` → structural spine: note order, `duration`, bar lines, repeat/ending marks,
  tie flags, decorations, written spelling (for display).
- `setUpAudio` → `Map<startChar, midiPitch>` for the correct **sounding pitch** feeding
  candidate mapping.

MIDI is exactly what candidate mapping wants (the instrument layout maps sounding pitch →
buttons; enharmonic spelling is irrelevant to which button sounds). Written spelling is kept
for the tab display only.

Join caveats to handle in the adapter:
- **`setUpAudio` plays the repeats.** A note inside `|: :|` emits one audio event *per pass*,
  all at the same `startChar`, so the raw join yields the pitch duplicated (`^A` in a repeated
  bar joined to `[70, 70]`). Since we tab as written and do not unroll (ADR 0006), **dedupe
  pitches per `startChar`** when building the map (keep distinct pitches for future `[GBd]`
  chords, drop exact repeats). Confirmed empirically by the prototype's tests.
- Grace notes and rolls emit extra short audio events at their own `startChar`; only map the
  main-note offsets.
- A tied continuation note is merged into one longer audio event at the *first* note's
  `startChar`, so the continuation has no audio entry — take its pitch from the tie
  (same pitch as its start) or merge tied notes in the spine.

## Extraction confirmed (roadmap checklist)

| Needed | Source | Status |
|---|---|---|
| Pitch sequence (sounding) | `setUpAudio` MIDI, joined by `startChar` | ✅ |
| Durations | `parseOnly` `duration` (fraction of a whole note; `0.125` = quaver at `L:1/8`) | ✅ |
| Bar positions | `parseOnly` `el_type:'bar'` | ✅ |
| Metre | `getMeterFraction()` → `{num,den}`; plus `getBarLength/getBeatLength/getBeatsPerMeasure` for beat-strength | ✅ |
| Key-sig-applied accidentals | `setUpAudio` (never `parseOnly`) | ✅ |
| Ties | `parseOnly` `startTie/endTie` | ✅ (not exercised by fixtures) |
| Repeats / variant endings | `parseOnly` `bar_left_repeat`/`bar_right_repeat`/`startEnding`/`endEnding` | ✅ |

## Decision — DO NOT unroll; tab as written, DP over written order

Decided with Clara (2026-07-03). MVP keeps the tab **concise**: repeats and variant endings
stay as `|: :|` / 1st–2nd-ending marks in the output, each written note appears once, and the
DP runs over the **written** note order. The adapter emits notes in written order plus the
repeat/ending structure the renderer needs.

Three options were on the table:

| | Engine (DP) sees | Final tab |
|---|---|---|
| A. Fully unroll | played order | doubled-out, no repeat marks |
| B. Unroll internally only | played order | concise, keeps `\|: :\|` |
| **C. No unroll (chosen)** | **written order** | **concise, keeps `\|: :\|`** |

Rationale for C:
- Concise tab gives each written note exactly one fingering. If two passes ever wanted
  different fingering, concise tab cannot express it anyway — so B's richer internal view
  would be collapsed back to one fingering regardless.
- The only transitions B models that C does not — the `:|`→`|:` jump-back and the 1st/2nd
  ending seams — all land on section/phrase boundaries, where the cost model already makes
  bellows reversals nearly free (`melodeon-domain.md`). So the accuracy gap is second-order,
  and the domain doc explicitly accepts phrase-boundary approximation.
- Accepted cost: only one fingering (and later, one chord accompaniment) per written note —
  no "different second time through". A player's PDF example of alternate chords on the repeat
  exists and would make a good fixture when the bass end is built (post-MVP).

**Upgrade path preserved:** because the tab output is identical, C → B is an engine-only change
(feed the DP played order, fold the result back). No renderer change. Revisit only if
section-boundary fingering looks wrong during cost tuning (step 6).

**Warrants ADR 0006 (tab as-written, no unroll, phrase-boundary approximation).** Not written
yet — will propose it next.

## Proposed adapter shape (`src/parse`)

```ts
// abcjs stays confined here (Invariant 2). Output is our own note-sequence type.
export function parseAbcToTune(abc: string): ParsedTune

interface ParsedTune {
  title: string
  key: string              // e.g. "Dmaj" (from metaText / getKeySignature root+mode)
  metre: [number, number]  // getMeterFraction -> [num, den]
  notes: NoteEvent[]       // WRITTEN order, each note once
  bars: BarMarker[]        // repeat/ending structure for the renderer to redraw |: :| etc.
}

// Enough to reproduce the written barlines and repeats in the tab.
interface BarMarker {
  beforeNoteIndex: number  // this barline sits before notes[beforeNoteIndex]
  type: 'thin' | 'left_repeat' | 'right_repeat' | 'thin_thick' | …
  startEnding?: 1 | 2      // from abcjs startEnding/endEnding
  endEnding?: boolean
}
```

Build steps inside the adapter:
1. `parseOnly(abc)` → walk `lines[].staff[].voices[]` in written order, building the note
   spine (each note's `startChar`, `duration`, tie flags, decorations) and collecting bar
   elements as `BarMarker`s (type + `startEnding`/`endEnding`).
2. `setUpAudio({})` → `Map<startChar, midiPitch>`; attach sounding MIDI to each spine note.
3. Emit `NoteEvent[]` in written order: convert `duration` (whole-note fraction) to ticks,
   accumulate `startTicks`, tag `bar`, and compute `beatStrength` / `phraseBoundaryBefore`
   from `getBeatLength`/bar position (phrase boundaries approximated from bar lines, long
   notes and rests per the domain doc). No unrolling.

The DP consumes `notes` directly (written order). The renderer consumes `notes` + `bars` to
draw the concise tab with repeat marks. `NoteEvent` may gain a `writtenName` (display
spelling) and a source-`startChar` for override identity; `notes.ts` is a first draft and can
flex — likely to carry the `bars`/repeat structure on `Tune`.

## Verification against official docs

Checked the empirical findings against docs.abcjs.net and the paulrosen/abcjs examples
(context7). Outcome:

- **Audio `pitch` is absolute MIDI — CONFIRMED by docs.** The synthesized-sound page
  documents each audio event's `pitch` as *"The MIDI pitch (60 = middle C)"*, and `start`/`end`
  with *"1 being the length of a whole note"*. This confirms both the sounding-pitch source and
  our duration units (`0.125` = quaver = ⅛ whole note). Our measured `F`→66 (F♯4) in `K:D` is
  consistent.
- **Key-sig + within-bar accidental carry in the MIDI path — CONFIRMED empirically, not by
  docs.** The docs don't spell out carry/key-sig resolution, but our crafted tests are direct
  evidence (`A ^A A A | A` → `69 70 70 70 | 69`; `^A =A A` → `70 69 69`; `K:D F F F` → `66 66
  66`). abcjs's synth maps these events straight to soundfont samples, so the pitch is
  necessarily fully resolved before audio.
- **`midiPitches` on note elements — real but undocumented convenience.** The official
  `editor-synth` example passes `abcElem.midiPitches` / `abcElem.midiGraceNotePitches` straight
  into `synth.playEvent`, so resolved MIDI is also attached per-element after audio setup. It is
  not in the structure reference, so we prefer the documented audio-sequence + `startChar` join;
  `midiPitches` is a possible simplification to revisit.
- **⚠️ NEW CAVEAT — the visual/`lines` object is explicitly NOT version-stable.** The
  render-abc-result page states its format is *"NOT guaranteed to be backwards compatible …
  retest whenever you upgrade abcjs."* We depend on `lines[].staff[].voices[]` shape for
  structure. Mitigations: (1) abcjs stays confined to `src/parse` (Invariant 2) so a break is
  localised; (2) **pin the abcjs version** and treat upgrades as deliberate; (3) the fixture
  tunes here become **round-trip parser tests** that would catch a structural break on upgrade.
  The diatonic `pitch` numbering (C=0, 7/octave) is our own observation and equally unguaranteed
  — but we only use `parseOnly` for *structure*, never for sounding pitch, so we don't depend on
  those integer values.

Net: findings stand. The one adjustment is defensive — pin abcjs and add fixture round-trip
tests when the adapter is built, because the parsed structure we walk is officially unstable
across versions.
