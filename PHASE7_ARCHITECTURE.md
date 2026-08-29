# Phase 7 — Architecture + Training Model Refactor

Phase 7 formalizes the training model shared by programming, prescription snapshots,
Coach decisions and future analytics.

## Per-exercise model

Each programmed block is normalized with:

- `trainingRole`: skill / strength / hypertrophy / endurance / power / mobility
- `priority`: primary / secondary / support
- `progressionMode`: explicit progression strategy
- `fatigueCost`: 1–5 planning heuristic
- `muscleGroups`: primary muscle groups affected
- `effectiveSetWeight`: internal workload heuristic (0–1), not a physiological claim
- `gripDemand`: none / low / moderate / high

The source of truth is `src/trainingModel.ts`. `PROGRAM` enriches blocks with this profile
at load time so existing UI/program consumers see the same normalized fields.

## Why effective set weight is heuristic

A skill attempt, a strength set, a hypertrophy set and an EMOM minute are not equivalent.
The weight is therefore only an internal accounting tool for planning and fatigue summaries.
It must never be presented to the athlete as an evidence-based count of "effective sets".

## Coach integration

High-fatigue exposures (cost 5) with RIR below 1 are held rather than automatically progressed.
Readiness gates and explicit session fatigue remain higher-priority blockers.
Historical prescription snapshots now retain the training role metadata so later program changes
do not erase the context of the completed exposure.

## Phase 7 design rule

Skill quality, strength, hypertrophy, density and power are evaluated with different logic.
The Coach should not compare a skill set or EMOM minute as though it were a generic rep set.
