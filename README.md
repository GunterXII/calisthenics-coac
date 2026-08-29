# Calisthenics Coach V8 — Production Polish

React + TypeScript + Vite + Tailwind + lucide-react.

Primary navigation:
- TODAY
- PROGRESS
- REPORTS

V8 fixes / hardening:
- robust timers based on real timestamps
- wake lock while training where supported
- rest timer skip + completion handling
- EMOM auto minute flow with timestamp-based timer
- static skill timer based on timestamps
- explicit modified flow
- saved session notes
- weekly report history
- session detail history
- JSON export/import backup
- explicit haptic toggle
- coach range vs today target
- per-set previous comparison
- right/left skill tracking
- handstand checklist
- skip/incomplete/modified distinction
- localStorage v8 schema

Data is local to the same browser/device until cloud sync is intentionally added.

## V8 hardening
- Session history retained in Reports.
- Historical session detail + editable session note.
- Export/import full JSON backup.
- Set/minute inline editing without browser prompts.
- Real timestamp-based rest, EMOM and static skill timers.
- No new primary navigation beyond Today / Progress / Reports.

## Progression engine
Each exercise can expose a current variant, next variant, coach promotion rule, and band role. The UI shows the progression inside the workout player and again at workout completion. A qualifying result is first marked `1/2 QUALIFYING SESSIONS`; two consecutive qualifying sessions become `READY FOR COACH REVIEW`. The app never changes the programmed exercise automatically.

## Sunday
Sunday is the athletic lower-body day: dynamic warm-up, broad jump + countermovement jump, Bulgarian split squat, pistol progression, single-leg RDL, split jump, calf raise and band leg curl.

## V10 production flow
- PROMOTE changes the current variant for future sessions and persists locally.
- KEEP CURRENT records a coach hold decision.
- Current variant is shown in Today and the workout player.
- Unfinished sessions are auto-saved as drafts.
- The player can be exited, resumed, saved as a draft, or discarded.
- Progression remains coach-controlled: qualification never changes the program automatically.

## Phase 7
- Normalized training model for every programmed block: role, priority, progression mode, fatigue cost, muscle groups, workload heuristic and grip demand.
- Historical prescription snapshots retain the training-model context.
- Coach uses high-fatigue metadata to avoid aggressive progression when quality is already at the edge.
- Removed the duplicated nested `src/src` tree and nested package metadata; root `src/` is the single application source.


## Training correction — pull-focused goals
- Handstand tutorial removed from Monday Push A; the program now prioritizes the user's pull skill goals plus 100 push-up / 50 dips performance goals.
- Pull-up EMOM baseline recalibrated to 5–7 reps/min, progressing 5 → 6 → 7/min as output becomes repeatable and technically clean.
- Pull-up / close-grip pull progression gates now use 7/min as the current ceiling rather than 9–10/min.
