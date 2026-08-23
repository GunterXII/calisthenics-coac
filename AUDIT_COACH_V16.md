# Calisthenics Coach V16 — Coach Audit & Training Logic

## Coaching brief

Current specialization:

- Push x3/week: 100 standard push-ups in one set + 50 dips in one set.
- Pull x3/week: OAP + Front Lever + Front Lever Pull-up, with pull endurance supporting work.
- Training environment: outdoor calisthenics park, bodyweight + loop bands. No external weights.

## What changed

### Push programming

Handstand tutorial work was removed from the active Push program because it is not a current priority. Push is now built around three complementary exposures:

- **Push A:** Pike progression + standard push-up volume + dips volume.
- **Push B:** Pike progression + diamond push-ups + push-up EMOM + dips EMOM.
- **Push C:** Long-set practice for push-ups and dips + close-grip push-ups + push-up/dips EMOM.

The standard push-up still appears in the program multiple times because the end goal is a 100-rep standard-grip set; grip variation is supplementary, not a replacement for specificity.

### Pike performance progression

Pike push-up remains a performance movement and is shared across Push A/B so the app can accumulate evidence for the same progression ladder:

Pike Push-up → Feet-Elevated Pike Push-up → Wall HSPU → Deficit Wall HSPU → Freestanding HSPU.

The progression criterion remains two consecutive qualifying exposures with clean ROM and RIR 1–2.

### Logging integrity fix

The old program reused the same exercise IDs multiple times in a single workout (for example Push-up and Dips both appeared as repeated blocks). The workout logger stores one log per exercise ID, so repeated IDs could overwrite earlier sets/blocks.

This revision uses unique IDs for repeated movements (for example `pushup-volume`, `pushup-emom-b`, `pushup-emom-c`). This prevents log collisions and makes reports/trends trustworthy.

## Page-by-page UX / UI / logic audit

### Today — strong

Good:
- Clear session title and subtitle.
- Start/resume is immediately visible.
- Day switching is fast.
- Warm-up and session order are visible before starting.
- Progression hints are already surfaced inline.
- Push goal banner now gives the user the current objective immediately.

Potential future improvement:
- Add a compact “LAST BEST SET” chip for the two Push goals directly above Start Workout.

### Plan — strong

Good:
- The user can edit exercise/variant, sets, target, rest, EMOM duration, and band selection without touching code.
- Undo/reset exists.
- Coach-linked mode prevents local edits from conflicting with published coach prescriptions.
- Compatible exercise alternatives are filtered by skill/pattern/kind.

Important architectural decision:
- Keep the Plan page as the place where prescription is edited.
- Keep workout-time entry focused on performance logging, not full programming edits.

### Workout Player — strong

Good:
- Screen wake lock is present.
- Draft/resume exists.
- Sound and haptics can be toggled from the workout header and persist in settings.
- Rest timers automatically advance.
- EMOM duration is configurable before start.
- Per-set/per-minute editing is available.
- RIR and fatigue are captured.
- Long sessions are protected by clear skip/exit flows.

Sound logic:
- Rest completion fires a feedback event before the next set begins.
- EMOM minute completion produces feedback and moves to the rep-entry state.
- Static skills have start/complete feedback.

Future improvement:
- Add an optional 3-2-1 countdown sound before every timed work interval, not only static-skill flows.

### Reports — upgraded to coach dashboard

Added:
- 100 push-up goal card.
- 50 dips goal card.
- Best single-set performance.
- Recent performance.
- Short-term trend versus previous exposures.
- Fatigue warning when recent best-set performance drops materially.

The existing PR vault, exercise history, weekly reports, session details, athlete profile, coach link, and backups remain available.

This page is now the main place to answer: “Am I progressing, stalling, or accumulating fatigue?”

### Session Summary — strong

Good:
- Session metrics.
- Coach handoff text.
- Session feel and note capture.
- Export/copy functionality.
- Post-workout mobility flow.

Future improvement:
- Add a simple “COACH VERDICT” panel driven by the same goal/trend logic used in Reports.

### Athlete profile / data — useful but secondary

Good:
- Training days.
- Equipment.
- Goals/skills.
- Recovery snapshot.
- Coach context.
- Backup/restore.

Because the user trains at a calisthenics park, the equipment profile should remain constrained to bodyweight equipment and bands. No weighted-equipment assumption should be added to the athlete setup.

### Coach Workspace — useful

This is coach-facing rather than athlete-facing, and it already contains:
- athlete roster,
- program editing,
- progression decisions,
- session history,
- coach notes,
- program audit trail,
- athlete coaching profile.

No additional athlete-facing page is required yet; Reports now fills the missing “coach dashboard” role.

## Training logic verdict

The architecture now matches the intended specialization better:

**Push:** performance + volume + density + long-set specificity.

**Pull:** skill + performance + density.

The program should not test 100 push-ups or 50 dips every session. Most work remains submaximal, while the long-set day periodically exposes the athlete to the exact task being trained.

The key progression variables are:

1. best single-set reps,
2. total quality volume,
3. EMOM density/drop-off,
4. RIR/fatigue,
5. recovery trend,
6. consistency across weeks.

## Validation

TypeScript project build/typecheck: **PASS** (`tsc -b`).

Vite bundle verification could not be completed in this extracted environment because the uploaded `node_modules` copy is missing Rollup's platform-native optional package. This is an environment/package-install issue, not a TypeScript error in the edited source.
