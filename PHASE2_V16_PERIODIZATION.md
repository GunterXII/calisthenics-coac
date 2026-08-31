# Calisthenics Coach V16 — Phase 2: Periodization Engine

## Goal
Add the long-term programming layer above the existing V15 microcycle without changing the current PUSH/PULL split or session-level progression behavior.

## Implemented
- Added `periodizationEngine.ts`.
- Added a 16-week concurrent periodization cycle:
  - 4 weeks `ACCUMULATION`
  - 4 weeks `OAP_EMPHASIS`
  - 4 weeks `FL_EMPHASIS`
  - 3 weeks `ENDURANCE_EMPHASIS`
  - 1 week `REALIZATION`
- Added an explicit `DELOAD` plan that can be inserted adaptively without being part of the normal 16-week calendar.
- Added phase-specific adaptation weights for skill, strength, hypertrophy and endurance.
- Added a protected hypertrophy floor so specialization phases cannot mathematically zero out muscle-building work.
- Added phase week lookup for a cycle and phase transition helpers.
- Added goal-state helpers and status derivation from progress/trend/confidence.
- Added day-level emphasis multipliers for the existing Monday–Sunday split. These are planning multipliers, not exercise prescriptions; later program-building phases will consume them.
- Added phase review logic that considers scheduled duration, weekly fatigue/recovery and goal trend before advancing, repeating or deloading.
- Added per-muscle hypertrophy-stimulus extraction for later volume-budget work.

## Design rule
Phase 2 deliberately does **not** rewrite `PROGRAM`, mutate the weekly split, or directly change exercise prescriptions. It produces a `PeriodizationContext` that future program/prescription phases can consume.

This preserves the V15 coaching loop while introducing a slow programming loop above it:

`Phase → Week → Session → Exposure → Next prescription`

## Testing
- `tests/periodizationEngine.phase2.test.ts` added.
- Phase 2 test passes.
- Full existing `npm run test:all` suite passes unchanged.

## Build note
A full `npm run build` cannot currently be validated from the supplied archive because the extracted working tree does not contain the npm dependencies/type packages required by the existing UI (`react`, `vite`, `@supabase/supabase-js`, etc.). This is an environment/dependency issue, not an observed Phase 2 test failure.
