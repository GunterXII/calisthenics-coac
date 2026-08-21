# V15.7 — Athlete Snapshot + EMOM editor polish

## Athlete Snapshot
- Replaced the generic inline Athlete Profile emphasis with a compact coaching snapshot.
- Surfaces current goal, target date, priority skills, training rhythm, recent 14-day consistency, latest bodyweight, latest readiness status, performance snapshot, equipment and latest coach signal.
- Editing is now secondary: fields appear only after pressing EDIT.
- Kept the existing coaching-context fields so no data is lost.

## EMOM editor
- EMOM now uses a dedicated editor layout.
- Duration is a primary control (5–15 min).
- Target is labeled `TARGET / MIN`.
- Generic SETS and REST fields are hidden for EMOM because they do not represent the actual timer behavior.
- Added a note explaining that recovery is intrinsic to the EMOM minute.

## Verification
- `npx tsc -b` passes.
- Vite build could not be executed in the sandbox because the packaged Vite binary has execution permissions blocked (`vite: Permission denied`).
