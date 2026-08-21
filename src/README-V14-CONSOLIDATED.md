# Calisthenics Coach V14 — Consolidated

This package consolidates the V14 backend work completed so far on top of the production-ready athlete UI baseline.

## Included
- Existing production-ready workout UI/player and program data.
- Supabase Auth + local-first workout sync.
- Persistent program overrides and coach decisions.
- Program/coach sync helpers.
- Supabase migrations 001–005.
- Canonical exercise catalog with progression graph; Edit Plan reads the backend catalog with a local 101-exercise fallback.
- `.env.example`.

## Setup
1. Copy the project into a clean folder.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
5. Apply migrations in order:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase_migrations_002_security_hardening.sql`
   - `supabase_migrations_003_program_sync.sql`
   - `supabase/migrations/005_exercise_catalog.sql`
6. Run `npm run build`.

## Important
Do not commit `.env.local` or any Supabase secret/service-role key.

The canonical weekly program remains compiled in the frontend for deterministic workout playback. The exercise library is now a backend-backed catalog with stable IDs and a progression graph; program overrides remain athlete-scoped and synchronized.

## Current scope
This is the V14 state completed so far. The post-workout mobility feature discussed later is not included in this package yet.
