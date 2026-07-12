# Roadmap

## MVP — complete

Steps in dependency order.

- [x] **1. abcjs spike** — decision: tab as written, no unroll (ADR 0005). Findings: docs/abcjs-spike-findings.md.
- [x] **2. Core data model** — instrument schema, note/fingering types finalised in src/domain; `DG_STANDARD` is a verified 21-button D/G layout (lesterbailey.org).
- [x] **3. Candidate mapping + feasibility** — src/engine/candidates.ts `mapTuneCandidates`; diatonic gaps confirmed to surface correctly against fixtures (e.g. Jiggery Pokerwork's A#).
- [x] **4. DP engine, naive costs** — src/engine/cost.ts + src/engine/fingering.ts, shortest-path DP with pin-and-recompute (ADR 0003).
- [x] **5. Ugly tab renderer** — src/render/tab.ts `renderTab`, pure view over `FingeringResult` (Invariant 5); its on-screen convention was provisional and is now superseded by the verified Mel Biggs convention (ADR 0006).
- [x] **6. Cost tuning** — beat-strength and bellows-air are both wired into `cost()` (ADR 0003): reversals are beat-scaled and cheap onto strong beats, and long same-direction runs are penalised via a duration-based air-pressure term (`CostContext.sameDirectionBeats`, accumulated from real `durationTicks`; `airPenaltyRate`/`airComfortBeats` in `src/engine/cost.ts`, currently `0.4`/`8`). Mel Biggs' tab convention is verified and implemented (ADR 0006). Closed for MVP purposes: the mechanism is built and hand-tuned against fixtures, and per-note overrides exist for whatever the engine still gets wrong (docs/melodeon-domain.md's "confidently correctable" philosophy). Cost tuning is open-ended by nature and continues post-MVP rather than gating MVP completion — see below.
- [x] **7. Interaction layer** — override popup pins a candidate, `computeFingering` recomputes downstream (ADR 0004); low-confidence near-tie marking (src/engine/confidence.ts); pins + ABC persist to localStorage.

## Post-MVP roadmap

**Next priority: bass end and chord suggestion** (see docs/melodeon-domain.md's bass end section) — chord names derived from simultaneous sounding pitches, cross-row bass hacks working for free from the direction→pitches model. Promoted ahead of the rest of the backlog because melody fingering already needs a real answer to "which row/direction," and per-note bellows direction — the melody engine's existing output — is exactly the coupling variable the bass layer needs; nothing here is throwaway.

**Ongoing cost tuning** (carried over from step 6, not newly discovered):
- `basicBeatStrength` (src/domain/notes.ts) models only two levels below the downbeat: the bar's first tick gets 1.0, every main beat 0.6, everything else 0.2. It captures no *secondary* accent structure, so two things are wrong. (a) Simple metres lose their internal hierarchy — in 4/4 beat 3 should outrank beats 2 and 4, but all three flatten to 0.6, so a reversal onto beat 3 is costed the same as onto beat 2. (b) Irregular metres (5/4, 7/8, 7/4…) felt as asymmetric sub-groups get no grouping at all — only the `den === 8 && num % 3 === 0` jig/compound family is special-cased. Reproduced by src/fixtures/tansys-golowan.abc (5/4).
- **Rejected, not a gap:** a static per-tune home-row preference was designed but never implemented, then rejected — key changes mid-tune and a required minor/modal exclusion left too little real repertoire where it would apply. Chord calculation (above) is the better lever on the same underlying problem: it's what actually drives a real player's row/direction choice.
- **Accepted simplification, not a gap:** `cost()` has no standalone "phrase boundary" reversal discount distinct from bar-relative beat strength — see docs/melodeon-domain.md's Fingering engine section. Checked against every fixture tune; never changes the chosen fingering, since long notes/rests overwhelmingly land on strong beats already.

**Rest of the backlog** (see ADRs + docs/melodeon-domain.md): layout presets/editor, remaining tab styles, strategy presets UI, database/auth; **computing fingering for every note of a bracket chord** — MVP only fingers the top pitch and collapses the rest away (now surfaced visibly, `*` + tooltip in `src/StaffTab.tsx`, rather than silently, but the other notes still aren't played at all); a real fix needs each simultaneous pitch to resolve to its own candidate, all sharing one bellows direction, which is the same right-hand chord-feasibility problem `docs/melodeon-domain.md` already flags for bass-end voicings. Fixture: `src/fixtures/a-christmas.abc`.
