# V15.4 Final Coaching Loop Audit

## P0 closed

- Legacy athlete-side promotion flow removed from Session Summary; Coach Decision Center is the single progression authority.
- Program block identity remains separate from canonical catalog exercise identity.
- Coach-managed program sync is server-authoritative; stale local overrides are cleared instead of winning over remote coach changes.
- Coach-managed local progression decisions are not uploaded as athlete-authored program decisions.
- Coach/athlete relationship and program mutations remain backend-authoritative through RPCs.
- Audit history, decision history and program history remain preserved.

## Coach closed

- Athlete goals/profile context persisted in Supabase.
- Adherence view: scheduled vs completed over the last 7 days.
- Weekly load: sessions, sets, reps, EMOM and average fatigue over recent weeks.
- Exercise-level six-exposure trend: latest, best, direction, consistency, average RIR, fatigue, pain and band context.
- Coach memory: recent audit/decision history visible in the workspace.
- Decision center remains the human approval layer.
- Skill Graph and Skill Intelligence remain the recommendation layers.

## Athlete closed

- Readiness capture is now a first-class, lightweight step before the warm-up (sleep, energy, wrist/elbow pain, optional weight) with skip support.
- Current coach focus/goals visible in Today.
- Athlete can edit their own coaching profile/goals in Reports.
- "Why this exercise" context is visible in the workout player.
- Post-workout feedback is captured before closing the session.
- Recovery trend is visible in Progress.
- Recent coach decision log is visible in Plan.
- Coach-managed athletes cannot directly edit future prescriptions or promote skills from the athlete-side Summary.

## Backend additions

- `athlete_coaching_profiles` table with RLS.
- `athlete_save_own_profile()` RPC.
- `coach_save_athlete_profile()` RPC.
- New supporting indexes for coach notes, mobility logs, personal records and program audit/decision ownership.
- Trigger function execute grant retained for authenticated runtime; anonymous execute revoked.

## Intentionally deferred

- Vercel/Vite production entrypoint issue remains isolated from the coaching loop work and should be handled in the final release/polish pass.
- Full production `npm run build` was not verified in this environment because dependency installation timed out.
