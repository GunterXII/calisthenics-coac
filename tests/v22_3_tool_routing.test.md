# V22.3 tool-routing regression

Expected routing from `src/coachAiGateway.ts`: 

- `ciao` / `buongiorno` -> no tools.
- `qual è la mia fase?` -> no tools; phase is already in deterministic context.
- `quanto volume ho per chest?` -> `get_hypertrophy_status`.
- `come sto recuperando?` -> `get_weekly_workload`.
- `cosa è successo nell'ultimo workout?` -> `get_recent_sessions`.
- `come modifico il programma per aumentare l'ipertrofia senza compromettere OAP?` -> program + workload + hypertrophy + goal + experiments + simulations.
- A greeting must never trigger the generic workload/hypertrophy/session bundle.
