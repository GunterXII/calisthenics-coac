# V16 Phase 7 — Architecture, training-model hardening and athlete UX

Implemented:
- Separate training exposure criteria from mastery criteria.
- Add explicit progression gates so a strong single exposure cannot promote a skill.
- Harden OAP promotion gate to require repeated unilateral clean performance rather than an over-demanding six-set rule.
- Add normalized training-profile/stimulus aggregation; stimulus and fatigue remain separate internal planning signals.
- Replace raw RIR/fatigue selects with plain-language tappable controls in the workout player while keeping the stored numeric values backward compatible.
- Clarify the meaning of RIR and perceived fatigue in athlete language.
- Confirm Coach chat reset before destructive history clearing.

Design rule:
The athlete should never need to understand the internal workload math. The UI collects the smallest consistent set of subjective signals and the Coach combines them with objective output, quality and recovery.
