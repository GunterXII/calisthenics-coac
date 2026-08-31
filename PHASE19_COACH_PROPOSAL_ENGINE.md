# Phase 19 — Structured Coach Proposal Engine

## Goal
Turn an athlete question into a constrained, inspectable proposal without allowing the language model or a free-form parser to mutate the program directly.

## Flow
question → candidate exercise → single-variable change → read-only simulation → evidence + confidence + warnings → pending CoachProposal → human approval.

## Safety boundaries
- No direct program mutation.
- Only one program variable is changed per proposal.
- Existing proposal records remain the source of truth for approval.
- Low recovery reduces confidence and emits an explicit warning.
- Unsupported changes fail closed.

## UX
The athlete can use **TRASFORMA IN PROPOSTA** from the Coach panel. The app shows current vs proposed prescription, evidence, confidence and warnings. Saving only creates a pending proposal; existing approval flow remains responsible for applying it.

## Tests
`tests/coachProposal.phase19.test.ts` covers proposal creation and refusal to create a proposal when the question is informational only.
