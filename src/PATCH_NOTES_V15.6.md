# V15.6 — EMOM clarity + athlete snapshot polish

## Changes

### EMOM duration is now editable from Plan
- EMOM cards show the configured duration directly (e.g. `10 min EMOM`).
- The prescription editor now includes an `EMOM DURATION` control.
- Range is 5–15 minutes.
- Saving an EMOM prescription also updates the default duration used by the workout player.
- Resetting the prescription restores the original program duration.
- Existing per-session duration adjustment in the workout player remains available before starting.

### Athlete Profile → Athlete Snapshot
Replaced the long, low-value profile form with a compact coaching context card showing:
- primary goal + target date;
- latest recorded bodyweight;
- training frequency + equipment setup;
- priority skills;
- latest coach decision/context and personal notes when available.

The editable fields are still available behind `EDIT` and remain synced to the existing local/Supabase profile flow.

### UI polish
- EMOM prescription summaries no longer show the misleading `1 sets` label.
- EMOM cards prioritize duration + target for faster scanning.

## Validation
- `tsc -b` passes.
- Full Vite build remains dependent on a clean local install because the available sandbox node_modules is missing Rollup's optional native package.
