# V19 — Production Coach Core

Implemented in this pass:

- Repeatable / quality-adjusted goal capacity remains distinct from record performance.
- Bilateral OAP analytics and skill-readiness gating.
- Front Lever Touch remains an explicit goal, separate from the prerequisite full Front Lever.
- Hypertrophy response is tracked per muscle with current-vs-previous weekly comparison and qualitative confidence.
- Weekly stimulus targets are explicit and kept separate from observed values.
- Coach experiment evaluation now checks performance, quality and fatigue together rather than a single delta.
- Manual experiment rollback restores the previous program override and records the decision.
- Deterministic Coach agent refreshes structured tools before answering a question.
- Coach UI shows recent program changes and qualitative confidence rather than exposing pseudo-precise probabilities.
- TypeScript no-emit validation and the full test suite pass.

Deliberately deferred to the next production slice:

- full backend OpenAI tool-call loop inside the Supabase Edge Function;
- complete i18n migration of every legacy hard-coded UI string;
- replacing localStorage state shards with a single authoritative remote state model;
- a browser-based E2E suite with Playwright/Cypress.

These are kept separate because they require deployment/runtime integration rather than just domain-layer changes.
