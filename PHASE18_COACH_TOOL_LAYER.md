# V18 — Structured Coach Tool Layer

- Added read-only coach tools for goals, recent sessions, workload, hypertrophy, current program, change simulation and active experiments.
- `coachAiGateway` now sends tool definitions and a compact structured snapshot to the AI endpoint.
- Simulations never mutate the plan. Program mutations remain behind human-approved `CoachProposal`.
- Added Phase 18 test coverage.
