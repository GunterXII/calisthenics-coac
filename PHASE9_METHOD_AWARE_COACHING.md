# Phase 9 — Method-aware coaching

## Scope
The coaching system now treats push-up/dip density as a distinct progression method instead of inheriting generic hypertrophy or EMOM progression.

## Monday density block
- 5 fixed sets.
- Starting dose is approximately 70% of a working max reference.
- Push-up seed working max: 40 reps.
- Dip seed working max: 45 reps.
- The engine can raise the working-max estimate when a better non-EMOM set is historically recorded.
- Initial rest: 120 seconds.
- Allowed density progression: 120 → 105 → 90 → 75 → 60 → 45 → 30 seconds.
- Rest reduction requires 2 comparable qualifying exposures at the same dose/rest, with acceptable drop-off, RIR and fatigue.
- Density blocks are excluded from generic +1 set hypertrophy progression.

## Other push days
- Wednesday keeps EMOM work.
- Friday keeps long sets plus EMOM work.

## Pulling
Skill-strength work remains distinct from general pulling capacity. No density-70 protocol is applied to OAP/FL/Archer/High Pull work.

## Data safety
The new method metadata is persisted in `PrescriptionSnapshot`. Historical comparisons continue to require matching variant, dose, rest, kind and band.

## Deliberate non-goals
- No automatic program mutation.
- No change to historical logs.
- No AI prompt changes.
- No UI redesign.
