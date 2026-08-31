# V17.3 — Adaptive Coach Core Hardening

This release adds a stricter adaptive layer for goal progression and hypertrophy protection.

## Decisions
- Goal analytics now expose repeatable performance as the program-facing current value; best remains an achievement metric.
- Weekly stimulus is estimated separately from fatigue, with RIR and quality modifiers treated as heuristics.
- Hypertrophy is tracked per muscle using productive-set-like proxies, not a global weekly floor.
- Primary adaptation can be compared with a phase target and the Coach can choose to progress, hold, add hypertrophy, reduce secondary work, or deload.
- The athlete-facing Coach panel surfaces the three most actionable signals: primary stimulus attainment, hypertrophy gaps, and recovery.

These are planning heuristics, not physiological measurements.
