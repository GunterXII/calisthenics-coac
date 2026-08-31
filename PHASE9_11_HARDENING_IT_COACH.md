# V17.2 — Coach Loop + Italian Athlete UX Hardening

Implemented:
- Automatic post-session Coach review persistence.
- No silent program mutation; phase changes require explicit approval.
- Coach review card shown immediately after workout completion.
- Italian copy cleanup for high-frequency athlete flows.
- Added Phase 9 Coach Loop regression test.

Design intent:
- deterministic engine remains source of truth;
- AI remains explanatory/advisory;
- athlete sees what changed, why, and whether an action is required;
- RIR/fatigue remain subjective trend signals, not physiological measurements.
