# 0004 — MVP scope: treble-only D/G, one tab style, localStorage

Status: accepted · Date: 2026-07-01

## Context

The core loop to validate is paste ABC → see playable tab → fix individual notes. The bass end is the most interesting extension but doubles the data-model surface and complicates the engine; its required input (per-note direction) is exactly what the MVP produces anyway.

## Decision

MVP: single hardcoded D/G treble layout (configurable schema, one instance, no editor UI); ABC textarea input, single melody voice; chord symbols ignored, bracket chords rejected/flattened; one suggestion strategy shipped as a cost function with no picker UI; per-note override popup (the differentiator — in scope); one tab style; visible unplayable-note handling; localStorage persistence.

Out: bass end, layout presets/editor, multiple tab styles, phrasing analysis, auth/database, staff notation display.

## Consequences

- Success measurable: three real session tunes yield tab a player accepts with a handful of one-click overrides.
- Nothing is throwaway: direction output feeds the future bass layer; cost function accepts presets; schema accepts layouts.
- Tab-style conventions (Rennie / Mel method / Mally's) must be verified against published examples before building each renderer.
