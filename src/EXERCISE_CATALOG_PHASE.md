# V14.4 — Exercise Catalog / Edit Plan

- `src/exercises.ts` contains the local 101-exercise safety-net catalog.
- Supabase migration `005_exercise_catalog.sql` creates `exercise_catalog` and `exercise_progressions`.
- `fetchExerciseCatalog()` reads the authenticated backend catalog and merges remote rows over the local catalog.
- Edit Plan now chooses stable catalog IDs and stores `catalogExerciseId` in the program override payload.
- Edit Plan filters alternatives by compatible skill or movement pattern instead of exposing an unstructured list.
- Authentication remains email/password + password reset in the V14 UI; Supabase Auth creates the athlete profile automatically.
