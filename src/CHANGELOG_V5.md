# V5 UX audit changes

- Rest timer now has an explicit SKIP REST control.
- Removed the ambiguous bare `3/5` control; controls are explicitly labeled RIR and Fatigue.
- Replaced duplicate Plan screen with WEEK: a six-day overview only.
- Workout player supports going back to previous exercises and editing their in-session logs.
- Standard rep logging is now a dedicated +/- stepper + direct text/number input, instead of a browser prompt.
- Each set shows the previous-session set result and a live `to match / ahead / matched` indicator.
- EMOM shows the previous session's same-minute result and the current minute's `to match / ahead / matched` indicator.
- Added an editable target control for reps per set or reps per minute; the chosen target persists in localStorage.
- Replaced FINISH with SKIP EXERCISE; saving is done through `SAVE & NEXT EXERCISE` only after the planned work is completed.
- Coach report continues to be generated only when the workout is completed.
