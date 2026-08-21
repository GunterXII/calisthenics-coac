# V15 Deep Audit — UI / UX / Flow / Logic / Reliability

## Scope
Reviewed the V15 athlete + coach application code, workout player, local storage, Supabase backend layer, migrations, and Supabase security/performance advisors.

## Critical findings fixed

### P0 — Coach decisions were not truly persisted by the Coach app
The Decision Center only wrote to localStorage via `saveCoachDecision()`. The athlete sync path could upload those records later, but the coach itself never performed that sync. A browser refresh/device change could therefore lose the coach decision from the authoritative backend.

**Fix:** added `coach_record_decision()` SECURITY DEFINER RPC with coach/athlete relationship validation. It writes both `program_decisions` and `program_audit_log`. The Decision Center now persists through this RPC and shows a visible save error if persistence fails.

### P0 — Editing a program block reset its sort order to 0
`CoachProgramEditor` published every edit with `sortOrder: 0`. After a reorder, editing one block could therefore move it to the front on the next load.

**Fix:** editor receives the real rendered index and preserves it when publishing.

### P1 — Static skill quality selection was logged one attempt late
The static player pushed `lastQuality` into the array when the attempt ended, while the UI allowed the user to change quality only after stopping. The selected quality for the current attempt was therefore not reliably saved.

**Fix:** current attempt now uses a dedicated `attemptQuality` state and that value is committed when the attempt ends.

### P1 — Performance Dashboard said “last 6” but counted exercise exposures from all fetched sessions
The dashboard fetched 30 sessions but counted logs from all 30 while labeling the card “LAST 6”.

**Fix:** exposure count now uses the same six-session window as the other dashboard metrics.

### P1 — Numeric target fallback could silently become 1–99
The generic range parser defaulted to `99` when no upper bound existed. This was inconsistent with the product rule that targets should come from an explicit coach prescription.

**Fix:** a missing upper bound now collapses to the explicit first number; a completely missing target defaults to a single safe value rather than an artificial 99 ceiling.

## UX findings addressed

- Added a compact sticky Coach Workspace section navigator: **Overview / Program / History**.
- Added visible error feedback for failed Coach Decision persistence.
- Program Builder keeps reorder context when editing blocks.

## Logic findings still intentionally deferred

### Athlete progression authority
The athlete-side `PromotionPanel` and post-session Summary can still promote a progression locally. When an athlete is linked to a coach, the authority model should eventually become explicit: **coach-managed programs should require coach approval**, while unlinked athletes can self-progress.

### Duplicate progression UI
Promotion appears both inside the workout player and in the post-session Summary. This is functional but creates two decision points for the same event. V15.1 should consolidate this into one authoritative progression review surface.

### Coach Intelligence is heuristic, not yet skill-specific
The current engine uses readiness, pain, volume and adherence. It does not yet understand the exact quality rules for every OAP / Front Lever / Planche / Hefesto progression. This is intentionally the next V15.1 layer.

### Local/remote state remains dual-source
The athlete application intentionally keeps localStorage for offline-first behavior while Supabase is authoritative when configured. The next architecture pass should make the source-of-truth states explicit to prevent future override conflicts.

## Supabase audit
Current project is healthy/active. Existing advisor warnings include:

- SECURITY DEFINER RPCs exposed to authenticated users (protected by internal relationship checks, but still flagged by the advisor).
- RLS policies that can benefit from `(select auth.uid())` initialization-plan optimization.
- Several unindexed foreign keys.
- Duplicate indexes on workout sessions.
- Multiple permissive policies on some mobility/program tables.

These are mostly architectural/performance hardening items, not blockers for the Coach workflow. The new Decision RPC follows the same authenticated + relationship-validated pattern and explicitly revokes anonymous/public execution.

## Flow verdict

**Athlete flow:** stable enough for V15.1, with progression authority as the main remaining design issue.

**Coach flow:** materially stronger after this audit. Program Builder, Performance Dashboard, Intelligence, Decision Center, Notes and Audit now form a coherent loop.

**Workout flow:** no new blocker found in the reviewed state. Static skill quality logging had a real correctness bug and is fixed.

## Next
V15.1 should build the skill-specific intelligence layer on top of this stabilized foundation.
