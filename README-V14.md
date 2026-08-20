# Calisthenics Coach V14.2 — Program + Coach Sync

This is the next layer after V14.1 Auth + Workout Sync.

## What changed

- The active athlete program now has a persistent Supabase record.
- Program overrides can be uploaded into `program_blocks.override_payload`.
- Remote program overrides are pulled back into local storage.
- Coach decisions are persisted in `program_decisions` and merged back locally.
- The sync remains local-first: the workout player still works without a backend connection.
- The database gets deterministic uniqueness for one active program and one override row per exercise.

## Apply the database changes

Run these migrations in order:

1. `supabase/migrations/001_initial_schema.sql` from the V14 backend foundation.
2. `supabase_migrations_002_security_hardening.sql` from V14.1.
3. `supabase_migrations_003_program_sync.sql` from this release.

## Code

Replace the V14.1 `src/lib/backend.ts` and `src/storage.ts` with the versions in this package.

The V14.2 backend exports:

- `fetchProgramLayer()`
- `syncProgramLayer()`

After authentication is restored, call `syncProgramLayer()` alongside `syncLocalSessions(getSessions())`.

## Important

The current program definition is still compiled into the app. V14.2 persists **changes/overrides and coach decisions**. The next phase can move the full canonical program definition into `program_blocks`, so a coach can publish a complete program without a frontend rebuild.
