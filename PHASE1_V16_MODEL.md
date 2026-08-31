# Calisthenics Coach V16 — Phase 1: Domain Model

## Goal
Add the domain primitives needed for concurrent periodization without changing the current workout split or progression behavior.

## Changes
- Added `TrainingAdaptation`, `PhaseType`, and the five current athlete goal IDs.
- Added `GoalState` for baseline/current/target/trend/confidence tracking.
- Added `PhasePlan` and `PhaseAdaptationWeights` for future phase/week programming.
- Added `StimulusProfile` as a separate model from workload/fatigue.
- Extended `TrainingProfile` with `stimulus`.
- Added exercise-level stimulus overrides for OAP, FLPU, Front Touch, their assisted variants, high pulls and the current endurance/density blocks.
- Added `stimulusProfileForBlock`.
- Added session-level adaptation accounting with `sessionStimulusByAdaptation`.
- Added muscle × adaptation accounting with `sessionStimulusByMuscleAndAdaptation`.

## Compatibility
Existing `effectiveSetWeight`, workload calculations, progression engine, program split and session UX are unchanged. V15 tests continue to pass.

## Design rule
Stimulus and fatigue are deliberately separate concepts. A skill such as OAP can have very high skill/strength stimulus without being treated as a high hypertrophy stimulus, while assisted and conventional hypertrophy work can contribute more strongly to hypertrophy with lower specificity.

The numeric stimulus weights are product heuristics for relative planning, not physiological constants or research-derived exact percentages.
