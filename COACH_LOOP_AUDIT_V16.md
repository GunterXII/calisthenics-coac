# Calisthenics Coach V16 — Coach Loop Audit

## Implemented
- Session Summary now generates persisted `CoachProposal` records for target progression when the logged session reaches the top of the current range with sufficient quality/RIR.
- Two consecutive qualifying exposures can generate a `variant` progression candidate.
- User must explicitly ACCEPT or REJECT each proposal.
- ACCEPT on a target proposal writes a `ProgramOverride` for future sessions and records a `program` coach decision.
- ACCEPT on a variant proposal updates the variant state, writes the program override, and records a `progression` coach decision.
- REJECT records a `coach` decision and leaves the plan unchanged.
- Proposal state is included in backup/restore.

## Safety / correctness checks
- `tsc --noEmit --project src/tsconfig.json`: PASS.
- No build claim: `npm ci` timed out in the execution environment, so Vite production build could not be executed here.
- Historical session logs are not mutated by proposal acceptance; only future program overrides are changed.
- Proposal acceptance is explicit and auditable; there is no automatic program mutation from performance alone.

## Known architectural debt
- The repository still contains substantial legacy `any` usage (131 lexical occurrences in the current TS/TSX tree). This is not introduced by the V16 coach-loop patch, but it means the earlier "eliminate any" foundation goal is not fully satisfied.
- The new proposal engine currently uses a generic range parser for target progression. Exercise-specific progression criteria remain in `skillIntelligence.ts` and the existing progression engine; these should eventually be unified behind one domain-level progression model rather than maintaining parallel rules.
- The proposal UI is intentionally attached to Session Summary. A future Coach/Reports queue should surface unresolved proposals from older sessions.
- Backend synchronization is best-effort; local state is updated first and `syncProgramLayer()` failures are intentionally non-fatal.

## Decision model
`performance -> proposal -> human decision -> program override -> audit log`

This is preferable to automatic plan mutation because a good session is evidence for a change, not permission to change the plan without review.
