# V20 Production Coach Core

V20 consolidates the coach around the real athlete loop:

`goal -> stimulus -> fatigue/recovery -> decision -> proposal/experiment -> outcome -> keep/rollback`

## Added
- `athleteResponseEngine.ts`: estimates individual response rather than using generic volume claims.
- `frontLeverTouchEngine.ts`: dedicated Front Lever Touch model (depth, hold, quality, repeatability).
- `coachDecisionEngine.ts`: goal-specific next-action decision layer.
- stronger experiment outcome classification (`SUPPORTED`, `INCONCLUSIVE`, `FAILED`).
- richer proposal metadata: confidence level, evidence, warnings and old/new values.

## Coaching principles
- Best performance is not the same as current capacity.
- OAP progression must respect bilateral/quality evidence.
- Front Lever Touch is its own goal; full Front Lever is supportive capacity.
- Hypertrophy remains a per-muscle constraint, not a global set count.
- Experiments need guardrails; a positive performance result with excessive fatigue is not a clean success.
- AI is an explanation/proposal layer, never the source of truth for program mutations.
