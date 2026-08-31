# Build fix + Black/Lime app icon

Applied only compatibility/type fixes for the reported `npm run build` errors and replaced the installed-app icon assets with the Black + Lime Calisthenics Coach icon.

Fixes:
- RecoveryStatus comparisons use the existing `FRESH` value.
- SkillInsight / ExerciseCoachDecision comparisons use `REVIEW`.
- SkillGraphStatus comparison uses `READY`.
- Mobility import uses `POST_WORKOUT_MOBILITY`.
- Mobility skip-all callback parameter is typed as `MobilityExercise`.
- No workout, data, calculation, storage, or Coach behavior changes.

Icon assets updated:
- `public/apple-touch-icon.png`
- `public/web-app-manifest-192x192.png`
- `public/web-app-manifest-512x512.png`
- `public/favicon-96x96.png`
- `public/app-icon-black-lime-1024.png`
