# V16 Phase 6 — Coach AI foundation + Athlete UX

## What shipped
- Dedicated athlete-facing COACH tab in primary navigation.
- Structured Coach context assembled from phase, goals, recent sessions, workload/fatigue and recovery.
- Deterministic coaching fallback with simple, athlete-friendly answers for RIR, fatigue, goal status, hypertrophy and workout-modification questions.
- Optional Supabase Edge Function gateway (`coach-chat`) for an AI response. The client never stores an OpenAI API key.
- Explicit system specification for the future AI coach: explain data, propose conservative changes, protect primary skill work and hypertrophy, avoid inventing values, do not silently modify the program.
- Chat history stored locally and capped to the last 30 messages.
- UI includes phase/week/recovery context, suggested prompts, accessible textarea + Enter submit, loading state, and an explicit note that AI suggestions do not automatically modify the program.

## UX / logic decisions
- RIR and fatigue are explained in plain language; the athlete is asked for consistency rather than fake precision.
- The AI layer is advisory. Program mutation remains deterministic / proposal-based.
- If the AI backend is unavailable, the app remains usable with local deterministic answers.
- No client-side secret is introduced. A Supabase Edge Function is the integration boundary for a future hosted model.

## Validation
All existing V16 test suites pass. Full Vite build cannot be confirmed in the provided archive because the local TypeScript type packages are incomplete in this environment.
