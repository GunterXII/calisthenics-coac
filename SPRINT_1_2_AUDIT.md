# V18 — Sprint 1 Coaching Engine + Sprint 2 UX Audit

## Sprint 1 — implemented

1. Removed duplicated progression qualification logic from `main.tsx`; UI delegates to `src/coachingEngine.ts`.
2. Centralized `ProgressionCriteria` through `criteriaForBlock()` and `variantMasteryCriteria()`.
3. Front Touch target progression uses the current range ceiling; variant mastery remains 3 clean holds at 8s+ across 2 consecutive exposures.
4. Missing RIR no longer qualifies when a criterion requires RIR.
5. Missing execution-quality data no longer receives a synthetic 82% score; missing quality blocks progression when quality is required.
6. Target and variant proposals require consecutive qualifying exposures rather than a single session.
7. EMOM progression now uses one stability engine (drop-off/CV/last-vs-first) via `emomStability()`.
8. OAP progression is evaluated through the shared reps/side criteria with both sides required.
9. PR detection is variant-aware: previous PRs are compared only against the same `exerciseId + variantName`.

## Sprint 2 — implemented

10. Workout player terminology is simplified to `RANGE` and `TODAY`.
11. Home removes redundant `TODAY'S FOCUS` card; workout player copy is less verbose.
12. Recent sessions now expose a compact Coach signal alongside time/reps/EMOM.
13. Home reduced by removing redundant secondary information.
14. Reports now contains performance data only; coach/profile/backup administration moved to a dedicated Settings tab.
15. PR moments include the variant in the displayed identity and compare against the same variant only.

## Validation

- TypeScript/TSX transpilation: PASS for modified core files.
- Full `npm run build`: not executed in this environment because project dependencies are not installed locally.
- No claim of a green Vite production build is made without running it on the user's machine.
