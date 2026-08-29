# Phase 8 — Workload & Recovery Engine

- Added `src/workloadEngine.ts`.
- Computes conservative per-session and 7-day workload heuristics from the Phase 7 training model.
- Separates muscle-group workload, fatigue load and grip demand.
- Adds time-decayed recovery estimates with explicit heuristic labeling.
- Surfaces workload/recovery in the post-session Coach Verdict.
- Adds exercise-level recovery overlap flags.
- Adds Phase 8 regression tests.
- Preserves skipped/incomplete as zero workload; modified exposures receive reduced workload but are not progression evidence.
