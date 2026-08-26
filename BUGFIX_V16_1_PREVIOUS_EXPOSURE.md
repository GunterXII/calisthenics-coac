# V16.1 — Previous Exposure / Variant Isolation Fix

## Bug
The workout player could show a `LAST` value that was not actually the previous comparable exposure.

Two causes were fixed:

1. In-progress/current-session logs could be considered as historical data.
2. A promoted progression variant shared the same `exerciseId` as the old variant, so the old variant's performance could appear as `LAST TIME` for the first exposure of the new variant.

Example: the first session of `Feet Elevated Pike Push-up` could display the previous `Pike Push-up` result as `LAST 12 reps`.

## Fix
- `WorkoutLog.variantName` is now stored with workout logs.
- Historical comparisons only use completed/modified exposures.
- Historical comparisons can be scoped to the current variant.
- The current/in-progress exposure is excluded using `existing.date`.
- Coach handoff comparisons now ignore current-session logs and only compare the same variant.
- Variant progression qualification now evaluates only logs belonging to the current variant.
- Old logs without `variantName` remain compatible for base variants through `variantName ?? exerciseName`.

## Expected UX
### First exposure of a new progression variant
No `LAST ...` value should be shown unless a previous exposure of that exact variant exists.

### Subsequent exposure
The player shows the corresponding set/minute/side from the previous exposure of the same variant.

### Coach handoff
`prev` and delta are reported only against a comparable completed exposure of the same variant, never against another variant or an in-progress record.

## Validation
The project source was patched successfully. A full `npm ci` / build could not be completed in this environment because dependency installation timed out and the local dependency tree was incomplete; therefore no claim of a fresh Vite production build is made for this patch.
