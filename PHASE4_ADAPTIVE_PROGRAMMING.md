# Calisthenics Coach V16 — Phase 4

## Goal
Introduce the fast adaptive loop above the V16 periodized program so the generated week responds to actual performance, recovery and workload without replacing the existing coaching engine.

## Added
- `src/adaptiveProgramEngine.ts`
- `tests/adaptiveProgramEngine.phase4.test.ts`

## Behaviour
- Protects primary skill exposure when recovery is poor.
- Reduces lower-priority volume/density under high fatigue.
- Adds a set to productive hypertrophy work after repeatable top-of-range performance and adequate recovery.
- Adds one minute to endurance EMOMs during the endurance emphasis when output is stable and recovery is good.
- Holds/regresses rather than escalating after low-output exposures.
- Uses weekly workload + per-muscle recovery + recent readiness + recent comparable performance.
- Keeps the fixed PUSH/PULL microcycle and V15/V16 coaching logic intact.

## Integration
`main.tsx` now calls `buildAdaptivePeriodizedDay(...)` for the current day. Manual program overrides are still applied after periodization/adaptation.

## Safety rules
- Adaptation is conservative: one small change per block per week.
- Primary skill work is protected before cutting secondary work.
- Hypertrophy additions are capped and only made with acceptable recovery.
- Endurance density changes by minutes, not by forcing failure.

## Test
`npm run test:phase4`
