# Phase 1 — Workout Engine

Implemented in `src/main.tsx`.

## Changes

- Final-set guard: bilateral set-based exercises no longer start an intra-exercise rest after the last set.
- Final-side guard: side-based exercises no longer start a rest after the final logged side.
- Existing transition recovery remains responsible for the gap between exercises.
- Skip flow remains explicit and logs `status: skipped` before continuing through the normal transition recovery.
- Added a `SUBSTITUTE` flow before an exercise starts. The original exercise is logged as `status: modified` with the athlete's substitution note, then the workout continues through the normal transition recovery.

## Validation

- TypeScript project compilation (`tsc -b`): PASS.
- Coaching/domain tests: PASS.
- Vite bundle could not be executed in the supplied environment because the ZIP's installed Rollup optional native package is missing; this is an environment/dependency-install issue, not a TypeScript compile error.
