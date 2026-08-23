# V19 Coach Audit Fixes

Applied against the uploaded V18.1 project.

## Program
- Reduced starting Push volume to a more conservative quality-first baseline.
- Kept 3 Push + 3 Pull structure.
- Preserved Pike Push-up performance work.
- Preserved Front Touch -> Wide Front Lever Touch -> SAT pathway.
- Full Front Lever hold remains outside the programmed workout.
- FL Pull-up progression standard unified to 5 x 4 clean reps across two consecutive exposures.

## Data / coaching engine
- Rep-based skill metrics now use best single set rather than total session reps.
- EMOM metrics remain total reps + drop-off.
- OAP qualification explicitly requires side data and six recorded sets.
- Push goal/PR reporting uses single-set performance.
- Structured athlete baseline added: push-ups, dips, pull-ups, OAP, FL pull-ups, Front Touch seconds.
- Baseline is persisted through Supabase preferences without requiring a migration.
- Push Volume Guard added: recommends starting/building/holding/reducing rather than blindly adding work.

## UX
- 0 reps remains a valid logged result.
- Athlete snapshot exposes current baseline and long-term Front Touch path.
- Progress copy now emphasizes best set, trend, target and next action.
- Feet-elevated Pike catalog no longer requires gym-only "bench" equipment; it uses a park-elevation capability label.

## Validation
- TypeScript build (`tsc -b`) passes in the supplied project.
- Static assertions verified all V19 changes are present.
- Vite production build could not be executed in this Linux sandbox because the uploaded Windows `node_modules` lacks the Linux Rollup optional binary. This does not indicate a source-code error; run `npm install` then `npm run build` on the Windows project as the final environment check.
