# Phase 12 build fix

Fixed the four TypeScript errors reported by the user:

1. `ExerciseCoachDecision.block` was replaced with `ExerciseCoachDecision.context.block` in the Coach Verdict UI.
2. `totalSessionReps` is imported from `workoutEngine`.
3. `shouldRestAfterStandardSet` is imported from `workoutEngine`.
4. `shouldRestAfterSideSet` is imported from `workoutEngine`.

The existing workout-engine helpers already enforce the intended last-set behavior:
- standard sets rest only when completed set count is below total sets;
- side-set rest occurs only after a completed L side when more sides remain;
- total session reps sums standard reps and EMOM reps.
