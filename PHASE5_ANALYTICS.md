# Phase 5 — Analytics / Usage

Implemented anonymous usage analytics without adding a runtime analytics SDK dependency.

## Local event store
- Stored in `localStorage` under `cc-v1-analytics-events`.
- Anonymous installation id under `cc-v1-analytics-anonymous-id`.
- Bounded to the latest 2,000 events.
- Exportable from Settings as JSON.
- Clearable from Settings.

## Optional PostHog
Set `VITE_POSTHOG_KEY` to enable forwarding. `VITE_POSTHOG_HOST` defaults to `https://us.i.posthog.com`.
`VITE_ANALYTICS_ENABLED=false` disables collection and forwarding.

No email, session notes, readiness values, reps, EMOM counts, or other workout-performance values are sent to PostHog by this layer.

## Tracked product events
- `screen_viewed`
- `navigation_clicked`
- `workout_started`
- `workout_resumed`
- `workout_completed`
- `workout_draft_saved`
- `workout_discarded`
- `workout_exit_opened`
- `readiness_opened`
- `readiness_submitted`
- `readiness_skipped`
- `exercise_started`
- `exercise_completed`
- `exercise_skipped`
- `exercise_substituted`
- `transition_recovery_completed`
- `program_edit_opened`
- `session_detail_opened`
- `session_report_details_toggled`
- `session_report_exported`
- `coach_handoff_copied`
- `session_feedback_saved`
- `coach_proposal_accepted`
- `coach_proposal_rejected`
- `mobility_started`
- `mobility_completed`
- `mobility_skipped`

The Settings usage panel summarizes top events and screens from the local event store so product usage can be inspected even offline.
