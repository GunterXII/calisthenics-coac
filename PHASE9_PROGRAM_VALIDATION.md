# Phase 9 — Program Validation / Simulation

## Purpose
Validate the whole planned week before the athlete runs it. The simulator evaluates planned workload, recovery spacing, grip demand, same-day overlap, sequencing, and upper/lower balance.

## Outputs
- Weekly validation score and severity (`OK`, `WATCH`, `HIGH`)
- Per-day adjusted workload, fatigue load and grip demand
- Muscle-group weekly workload totals and exposure frequency
- Signals with severity, reason and affected days
- Positive program strengths
- Planning notes clarifying that all signals are heuristics and do not represent exact physiology

## Rules
- Planned units are derived from each block's existing training model (`effectiveSetWeight`, `fatigueCost`, `muscleGroups`, `gripDemand`).
- Recovery is simulated from elapsed days and prior planned load with a conservative decay heuristic.
- High-grip pull days flag repeated pulling and suggest grip-independent core choices.
- High-cost primary blocks on the same day trigger sequencing review.
- Lower-body imbalance is flagged as a planning note only because this athlete intentionally prioritizes upper-body skills.
- The simulator never mutates the program automatically.

## UI
A new `PROGRAM VALIDATION` card is shown at the top of the Plan screen. It recalculates from the current effective program, including future program overrides.

## Validation
`tests/programValidation.phase9.test.ts` covers basic weekly simulation integrity, muscle totals, grip load, strengths and signal typing.
