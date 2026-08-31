# Phase 5 — Goal Analytics & Athlete Effort Logging

## Purpose
Phase 5 closes the gap between exercise-level progression and the athlete's five long-term outcomes:
- OAP ×5
- Front Lever Pull-up ×5+
- Front Lever / Front Touch improvement
- Push-up ×100
- Dips ×50

## Goal analytics
`src/goalAnalyticsEngine.ts` defines benchmark-based goal analytics. It separates:
- baseline
- current/latest benchmark
- best benchmark
- target
- recent trend
- benchmark evidence count
- quality-data coverage
- confidence
- interpretation

The engine intentionally uses benchmark exercises rather than aggregating every related exercise. This prevents assisted work or EMOM volume from being mistaken for direct goal performance.

## Benchmark mapping
- OAP → `oap`
- FL Pull-up → `flpu`
- Front Lever → `touch` (Front Touch)
- Push-ups → `pushup-long`
- Dips → `dips-long`

For quality-aware skills, sets marked `Lost position` are not treated as clean benchmark evidence.

## Reports UI
The Reports screen now exposes all five goals with:
- best benchmark / target
- progress bar
- latest performance
- trend
- evidence count
- interpretation
- current periodization phase

## Athlete logging UX
RIR and fatigue are still stored using the existing schema, but the workout player now explains the scale in plain language next to the controls.

RIR:
- 0 = no reps left
- 1 = one rep left
- 2 = two reps left
- 3 = three or more reps left

Fatigue:
- 1 = easy
- 3 = demanding
- 5 = very hard / nearly exhausted

The copy explicitly tells the athlete to be consistent rather than perfectly precise. Coaching decisions should rely more on repeated trends than on a single estimate.

## Scope boundary
The AI coach / natural-language workout-report assistant is intentionally not implemented in Phase 5. That is a later application layer and should consume the deterministic analytics/coaching outputs instead of replacing them.
