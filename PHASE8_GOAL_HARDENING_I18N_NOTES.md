# V17 Phase 8 — Goal Hardening

## Goal semantics
- `front_lever_touch` replaces the incorrect `front_lever` goal id.
- Front Lever Touch is the actual goal/benchmark; a full Front Lever is treated as an ability/prerequisite, not the end target.
- Target benchmark remains 8s for the current product model, matching the existing Touch progression gate.
- Goal analytics now exposes `repeatableBest`, `qualityAdjustedBest`, and `recentMedian` so a single best exposure does not dominate long-term decisions.

## Next localization step
The next product task should introduce a real `src/i18n` dictionary and move user-facing strings out of `main.tsx`/coach UI. Italian should be the primary locale, with English retained as a fallback.
