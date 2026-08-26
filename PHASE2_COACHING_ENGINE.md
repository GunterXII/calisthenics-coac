# Calisthenics Coach — Phase 2 Coaching Engine

Implemented as a deterministic, testable coaching layer. No UI/Phase 3 redesign was introduced.

## Implemented

### Progression criteria
`ProgressionCriteria` now supports structured rules for:
- reps/set thresholds with optional RIR and clean-form requirements
- bilateral side requirements (used by OAP and Archer work)
- hold-duration thresholds
- EMOM minimums, drop-off, coefficient of variation and last-vs-first stability
- consecutive qualifying exposures

The important skill rules in `program.ts` now carry machine-readable criteria for Pike, Diamond, Archer, High Pull, Dips, Pull-up, Close Chin, Close Pull, OAP, Front Touch, FL Pull-up, Wide Touch and SAT.

### OAP R/L
The engine evaluates left and right independently from the logged `sides` array. A progression cannot be approved when one side is consistently lagging.

### Front Touch mastery
Front Touch promotion now requires 3 clean free holds at 8s+ for two consecutive exposures. Until that point the engine keeps the athlete on the current Front Touch progression instead of jumping to Wide.

### Front Lever Pull-up quality
Promotion requires 5 sets at 4+ reps, minimum RIR and a quality score based on execution metadata, fatigue and RIR. Quality is exposed in the insight panel.

### EMOM stability
Progression now evaluates output stability, not just the highest minute. The engine tracks drop-off, coefficient of variation and last-minute performance relative to the first minute.

### Readiness
A deterministic readiness analysis combines sleep, energy and joint-pain signals. Low readiness blocks progression decisions; significant pain moves the athlete to a regression/review state.

### Bodyweight-relative performance
The engine records a bodyweight-normalized performance value using the current bodyweight relative to a reference bodyweight. This is an explicit normalization aid, not a claim of a physiological strength equation.

## Validation

- TypeScript project build (`tsc -b`) passes.
- Vite production build was attempted but the provided environment is missing Rollup's Linux optional native package `@rollup/rollup-linux-x64-gnu`. This is a dependency-installation issue, not a TypeScript failure.
