# Roadmap

Steps in dependency order. Tick as completed; update this file as plans change.

- [x] **1. abcjs spike** — feed 2–3 real tunes (src/fixtures/*.abc) through abcjs, dump parsed structure. Confirm extraction of: pitch sequence + durations, bar positions, metre, key-signature-applied accidentals, ties, repeats. Decide: does MVP unroll repeats or tab as written? Output: findings note + decision, then the adapter shape. → **Done:** docs/abcjs-spike-findings.md; decision = tab as written, no unroll (ADR 0006).
- [ ] **2. Core data model** — finalise types in src/domain: instrument schema, D/G treble instance (**pitch map currently a placeholder — fill in and verify against a real box before relying on it**), note sequence, fingering result (chosen candidate + alternatives + pinned flag + confidence).
- [ ] **3. Candidate mapping + feasibility** — pure fn: note → candidates. Test against fixtures; confirm diatonic gaps surface correctly.
- [ ] **4. DP engine, naive costs** — constant reversal cost, small row-change cost. Signature `cost(from, to, context)` from day one, context ignored initially. Verify optimality and pin-and-recompute.
- [ ] **5. Ugly tab renderer** — text/bare HTML grid: button numbers, row marks, direction. First end-to-end moment: paste tune, see tab.
- [ ] **6. Cost tuning** — decide tab style + verify its published conventions; hand-finger fixture tunes as ground truth; add beat-strength and phrase-boundary context; iterate weights until engine mostly agrees. Open-ended by design.
- [ ] **7. Interaction layer** — override popup, downstream recompute wiring, low-confidence marking, localStorage persistence.

Post-MVP backlog (see ADRs + docs/melodeon-domain.md): bass end and chord suggestion, layout presets + editor, remaining tab styles, strategy presets UI, database/auth.
