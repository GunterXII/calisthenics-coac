# Calisthenics Coach V16.3 — Workout Timer & Recovery

## Implemented

- Large circular countdown for all normal set/hold recovery timers.
- Remaining time is shown as a large central stopwatch-style clock.
- Progress ring drains as recovery time decreases.
- Recovery completion uses the existing sound + haptic feedback system.
- Added a fixed 3-minute transition recovery between exercises (not between sets).
- Transition recovery shows the next exercise name and can be skipped.
- The 3-minute transition is also applied after an exercise is skipped, so the workout rhythm stays consistent.
- EMOM keeps fixed 60-second windows.
- EMOM now emits the start tone when a new minute begins after reps are logged.
- Transition recovery does not double-beep: the recovery-end sound is the single transition cue.
- Rest completion is guarded so React re-renders cannot trigger the completion callback multiple times.
- Workout draft state advances to the next exercise before the transition timer starts, so exiting during transition resumes at the correct next exercise.

## Coaching interpretation

The Wednesday order remains:

1. Pike Push-up
2. Diamond Push-up
3. Push-up EMOM
4. Dips EMOM

This is a sensible order for the current Push B structure: higher-skill/performance work first, then secondary pressing volume, then the specific push-up/dips endurance work. The Push B program is explicitly designed around pike progression plus diamond grip and push-up EMOM, with dips EMOM as supporting volume.

The 14/14/10/10/10/10/10/10/6/9 push-up EMOM should not automatically be interpreted as a failed target. It is a large drop-off after preceding pressing work. The coaching engine should use the surrounding session load and fatigue context before recommending regression.

## Verification

- TypeScript parser check completed without syntax diagnostics.
- Full `npm run build` could not be executed in this environment because the package registry dependency cache is incomplete (`npm install --offline` reports the Vite React plugin tarball is not cached).
