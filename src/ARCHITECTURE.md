
# Calisthenics Coach — V4 Audit

## Product decisions
- Only 3 top-level tabs: Today, Plan, Progress.
- Library removed from primary navigation; the current program is the library.
- Workout Player is full-screen and single-purpose.
- Final screen produces a Coach Report ready to copy.
- Previous-session result is shown before each block.
- Static skills use a 5-second countdown and real-time hold timer.
- EMOM logs each minute and computes total, average and drop-off.
- Accessory and assisted-skill blocks capture band, RIR and fatigue.
- No AI coaching inside the product; the app is a high-quality data capture layer for external coaching.

## Persistence
- localStorage for logs and session summaries.
- Same-device / same-browser persistence.
- Cloud sync is intentionally out of scope for this V4 prototype.

## Future backend
Tables/entities:
users, exercise_blocks, workouts, workout_logs, emom_minutes, skill_attempts, bands, weekly_reviews.

## Coaching export
`makeCoachReport()` produces the text payload used for the copy/download action.
