# Phase 2 — UI Screen Composition

UI-only redesign built on the Phase 1 Black + Lime design system.

## Scope
- Redesigned **Oggi** hierarchy: workout CTA, day switcher, today's focus, session list and previous-session context.
- Redesigned **Piano** hierarchy: weekly navigation, clearer explanation of the weekly program check, day prescription header and compact exercise rows.
- Simplified **weekly simulation / validation** presentation so the athlete understands what the score and warnings are for without exposing implementation jargon or unnecessary technical metrics by default.
- Restyled **RIR / Fatigue** controls as direct button choices with a clear selected state.
- Reduced visual competition between cards, metadata, labels and primary actions.
- Kept Black + Lime as the only primary interaction accent.
- Added reduced-motion support and mobile touch-target refinements.

## Explicitly unchanged
- Business logic
- Stored data
- Calculations
- Workout progression / prescription logic
- Workout timing and behavior
- Logging and persistence
- Navigation functionality
- Coach functionality

## Validation
- `src/main.tsx` passes TypeScript/TSX transpilation parsing.
- Full `npm run build` could not be completed in the supplied environment because the archived `node_modules` contains incomplete type-definition packages. Run `npm install` in a normal development environment and then `npm run build`.
