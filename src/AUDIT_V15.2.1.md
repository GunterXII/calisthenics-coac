# V15.2.1 — Deep UI / UX / Flow / Reliability Audit

## Result
The V15.2 skill-graph codebase was audited before the next feature pass.

### Fixed in this pass
- **Coach authority leak in athlete Plan:** linked athletes could still edit/reset their local plan while a coach was connected. Plan editing and RESET ALL are now hidden when a coach is linked.
- **Duplicate progression authority:** the post-workout progression controls are hidden for coach-linked athletes. Coach-managed programs remain coach-authoritative.
- **Skill Graph false readiness:** the graph previously treated the existence of a next mechanical rung as `READY`. It now reports `READY` only when Skill Intelligence marks the current rung `PROGRESS`; otherwise it remains `CURRENT`.
- **Skill Graph promotion lookup:** removed the fragile display-name → catalog-id lookup. Qualification is now keyed by the actual exercise id.
- **Migration completeness:** the V15.2 archive contained coach hardening SQL at the repository root but not in the active `supabase/migrations` directory. Added `011_coach_core_hardening.sql` and `012_tighten_program_audit_writes.sql` so a fresh migration run includes the hardening layer.

## Findings / watchlist
- `src/main.tsx` remains a large monolithic UI module (~1000 lines). It is not an immediate crash risk, but it is the largest maintainability hotspot and should be split after the current product layer stabilizes.
- LocalStorage + Supabase intentionally coexist. The sync contract is functional but remains dual-source; future work should explicitly model `local`, `remote`, `coach-managed`, and `conflict` states.
- Workout log replacement is keyed by `exerciseId`. This is safe for the current program because there are no duplicate exercise IDs within a single day, but a future repeated exercise block should use a block-instance id instead.
- The exercise catalog is a static local fallback plus remote catalog. Keep ids stable; use catalog ids as the canonical identity.
- There are no current duplicate exercise ids inside a single program day.
- `public/` is clean in V15.2 and contains only static assets; no duplicate source tree was found.

## Build validation
A local TypeScript/Vite build could not be completed inside the isolated audit container because dependencies were not installed in the supplied archive. The source-level audit was therefore supplemented with direct static checks.

## UX flow verdict
**Athlete:** workout → summary → mobility → history remains coherent; coach-linked athletes now have a clear read-only future-program boundary.

**Coach:** athlete selection → dashboard → skill intelligence → skill graph → decision center → program builder → notes → history is coherent. The graph is now explicitly decision-support rather than an implicit promotion mechanism.

**Next priority:** V15.3 should focus on skill-specific progression evidence, not another broad UI feature, and then split the monolithic `main.tsx` once behavior is stable.
