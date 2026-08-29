# Phase 8 — Workload & Recovery Engine

Implemented a conservative planning layer on top of the Phase 7 training model.

## Model
- Per-log workload is derived from the existing training profile, performed units, effective set weight and reported RIR/fatigue.
- Weekly workload aggregates adjusted sets, fatigue load, muscle-group exposure and grip demand.
- Recovery uses time-decayed recent fatigue (48-hour half-life heuristic) to classify each muscle as FRESH, RECOVERING, FATIGUED or HIGH_FATIGUE.
- `analyzeRecoveryForBlocks()` flags exercises whose target muscles or grip demand overlap with incompletely recovered resources.

These are explicitly planning heuristics, not physiological measurements or claims of literal "effective sets".

## Product behavior
- Post-session Coach Verdict now includes a 7-day Workload & Recovery card.
- Skipped/incomplete exposures do not add workload.
- Modified sessions can contribute reduced workload but do not create progression evidence.
- Grip demand is surfaced separately to catch pull-day forearm bottlenecks.
