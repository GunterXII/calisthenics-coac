# V15.5 — Personal Coaching Polish

Focused update for the personal parchetto workflow. No general-purpose workout engine was added.

## Changes

### EMOM
- Default remains 10 minutes.
- Duration can be changed before starting, from 5 to 15 minutes.
- The selected duration is remembered per EMOM exercise on the device.
- The session log now records the actual EMOM duration in the note.
- Target reps/minute remains independently adjustable.

### Progression guidance
- Today now surfaces a small progression hint only after two completed exposures exist.
- It uses the existing progression rules already in the app.
- A qualifying result is shown as a **CANDIDATE**, never an automatic promotion.
- This preserves the athlete → report → coach decision workflow.

### Warm-up
- Push warm-up is now more specific to wrists, scapular control and pike/overhead preparation.
- Pull warm-up is now more specific to active hang, scapular depression, straight-arm pulling, light high-pull rehearsal and elbow preparation.
- The warm-up remains short and minimal.

### UX polish
- Today’s focus copy now explicitly points to post-session progression review.
- No new analytics, gamification, generic equipment support or multi-athlete engine was added.

## Validation

The source package does not include `node_modules`; a clean dependency install is expected before `npm run build`.
The available environment could not complete dependency installation, so a full local build was not verifiable in this runtime.
