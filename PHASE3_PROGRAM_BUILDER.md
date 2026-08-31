# V16 Phase 3 — Program Builder

Phase 3 connects the V16 periodization layer to the existing PUSH/PULL microcycle. The base PROGRAM remains the source template; `programBuilder.ts` produces the current phase/week prescription without mutating the template.

## Behaviour
- Weekly undulation inside each phase changes set/volume exposure in a controlled range.
- OAP emphasis concentrates specific work on Thursday while preserving the rest of the pull structure.
- FL/FLPU emphasis concentrates specific work on Tuesday/Saturday.
- Endurance emphasis increases EMOM duration and rep/min targets, especially for push-up/dip work.
- Hypertrophy remains present in every phase; realization and deload reduce it instead of deleting it.
- Phase labels are embedded into the generated prescription detail for traceability.

## Integration
`main.tsx` now resolves the active 16-week cycle from a persistent Monday cycle start and uses the generated periodized day for Today, Plan and the Workout Player. Existing user program overrides are applied after periodization so manual customizations remain authoritative.

## Persistence
`storage.ts` contains the V16 cycle-start helpers. Resetting this value starts a fresh cycle on the next app render.

## Tests
`tests/programBuilder.phase3.test.ts` verifies: weekly variation, unload week, OAP/FL priorities, endurance expansion, deload reduction and complete 7-day week generation.
