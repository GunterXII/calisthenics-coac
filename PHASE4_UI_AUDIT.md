# Phase 4 — Report + Coach UI Audit

## Scope
Presentation-only refactor on the Phase 3 Black + Lime baseline. No business logic, data, calculations, storage, workout behavior, Coach engines or API behavior changed.

## Findings addressed
- Report contained too many equally prominent panels.
- Coach review, conversation and proposal states competed for attention.
- Legacy violet remained in active navigation and Coach chat/proposal surfaces.
- Several visible English strings remained in athlete-facing UI.
- Technical report details were visually too dominant relative to the actionable summary.
- Mobile Coach conversation needed a clearer bounded reading area.
- Interactive states needed a single lime accent language.

## Product direction
1. Athlete first sees what happened.
2. Then sees what the Coach thinks.
3. Then sees the proposed action.
4. Technical evidence remains available but secondary.
5. Lime is reserved for action, selection and meaningful status.
6. Neutral surfaces carry most information; borders are structural, not decorative.

## Remaining audit candidate
The source still contains a number of English/internal labels in Coach-admin areas and code-level strings. These should be reviewed separately from athlete-facing UI because some are domain identifiers rather than rendered copy.
