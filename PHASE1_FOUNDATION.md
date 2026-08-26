# Phase 1 — Foundation

This phase is intentionally limited to data/domain foundations. No coaching behaviour or UI feature was added.

## Changes

- Added an explicit backup/storage schema version (`16`) independent of the product release number.
- Backup imports now validate the payload and normalize legacy v8/v9 backups to the current schema.
- Added EMOM duration data to exports/imports.
- Reworked session replacement so replacing a session removes the complete previous session aggregate before writing the new logs. This prevents stale logs when a block is removed or a session is edited.
- Replaced `any` in the local storage/data foundation with typed models and generic setting accessors.
- Moved `ProgramOverride` and `CoachDecision` into the shared domain types.
- Added `TrainingRole` separately from `BlockKind` and assign roles to the default program without changing the workout taxonomy.
- Added a structured `ProgressionCriteria` domain model while keeping the existing human-readable `rule` field for compatibility. Criteria evaluation belongs to Phase 2.
- Hardened the skill-intelligence data boundary with explicit local interfaces instead of `any`.

## Validation

- TypeScript project build (`tsc -b`) passes.
- Vite production build could not be executed in this environment because the supplied dependency tree is missing Rollup's Linux optional native package (`@rollup/rollup-linux-x64-gnu`). This is an environment/dependency-installation issue, not a TypeScript failure.

## Non-goals

- No Phase 2 coaching logic was added.
- No UI redesign was added.
- No training prescription was changed in this phase.
