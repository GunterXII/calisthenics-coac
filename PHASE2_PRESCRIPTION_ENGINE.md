# Phase 2 — Prescription Engine

Implemented on the Phase 1 baseline.

## Prescription model
- Every workout log can now carry a `PrescriptionSnapshot`.
- Snapshot captures exercise/variant, kind, target range, today's target, sets, EMOM minutes, rest and band configuration.
- Historical logs therefore retain the prescription that was actually presented/used in that session.

## Future vs historical state
- Program overrides remain the source for future prescription changes.
- "Today target" values are stored with timestamps.
- A newer program override supersedes an older today-target value, preventing stale targets from overriding a coach change.
- Legacy numeric target values remain readable for backward compatibility.
- The active workout uses the effective block plus the effective today target; it no longer relies on a stale global numeric target.

## Reports
- Session reports and coach handoff include the captured prescription when available.
- This makes comparisons explicit instead of treating an unlabeled number as a generic target.

## Volume metric cleanup
- `SessionSummary.totalReps` now represents standard reps + EMOM reps.
- `emomReps` remains available separately.

## Validation
- Coaching Engine tests: PASS
- Domain hardening tests: PASS
- Atomic proposal tests: PASS
- Prescription target precedence smoke test: PASS
- TS/TSX syntax transpile check: PASS

Full `tsc -b` could not be completed in the provided environment because dependency installation was incomplete; the workspace was missing several type packages after the package install attempt timed out.
