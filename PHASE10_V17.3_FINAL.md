# V17.3 — Coach Core Hardening (completed)

Implemented on top of V17.2.

## P0/P1 fixes
- Program-facing goal state now uses repeatable performance after enough comparable evidence; best remains a separate achievement metric.
- Added `adaptiveStimulusEngine.ts` to estimate weekly stimulus separately from fatigue and to compare actual stimulus with phase targets.
- Added RIR/quality/proximity modifiers to productive hypertrophy proxies; these are explicitly heuristics, not physiological measurements.
- Added per-muscle hypertrophy tracking with low/adequate/high status.
- Coach Review now surfaces primary stimulus attainment and muscle-level hypertrophy gaps.
- OAP goal analytics is bilateral when side metadata exists: an exposure is scored using the weaker recorded side so one arm cannot mask the other.
- Fixed CoachPanel integration bugs: phase passed correctly to `buildCoachReview`, and persisted review state is read safely.

## Tests
- Full V16/V17 domain test suite: PASS.
- New adaptive stimulus suite: PASS.
- New goal-state semantics suite: PASS.
- TypeScript project check (`tsc -p src/tsconfig.json --noEmit`): PASS.

## Intentional limits
- Stimulus values are planning heuristics and should not be displayed as exact physiology.
- Full repository-wide i18n migration is not part of this hardening pass; existing Italian-first UI remains intact while the next localization pass can migrate remaining hardcoded strings.
