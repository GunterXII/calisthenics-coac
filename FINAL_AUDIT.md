# Calisthenics Coach — Final Audit

## Scope
Audit of the Phase 12 codebase after the final TypeScript fixes. Review areas: build blockers, workout flow, prescription/history integrity, Coach logic, workload/recovery model, programming coherence, UX/UI, analytics, and training evidence.

## Build / code integrity
- Fixed the four reported TypeScript errors in `src/main.tsx`.
- Existing automated regression suite passes all Phase 3/6/7/8/9/10 tests.
- Full local `npm run build` could not be reproduced in this container because frontend dependencies are not installed completely; the user environment has already reproduced the earlier four source-level errors, and those exact references are now fixed.

## High-priority code findings
1. Workout engine now skips intra-exercise rest after the final standard set and after the final completed unilateral side. The transition recovery between exercises remains separate.
2. `PrescriptionSnapshot` is retained in logs, which preserves the effective prescription used at the time of training.
3. Historical comparisons are filtered by exercise/variant and prescription fields; this is substantially safer than name-only comparisons.
4. Skipped and modified exposures are excluded from normal progression evidence.
5. The current total-reps calculation is `standard + EMOM`, so the report metric is unambiguous.

## Important remaining architecture caveats
1. Workload scoring is an internal heuristic, not a physiological measure. In particular, counting each EMOM minute as a workload unit can overstate weekly "set" volume if interpreted literally.
2. The recovery engine uses a fixed 48-hour half-life and heuristic scaling. It is useful as a conservative warning system, but it should not be presented as an objective recovery percentage.
3. The program-validation score is a heuristic aggregation. The individual signals are more trustworthy than the absolute score and should drive decisions.
4. The exercise model still contains some legacy catalog aliases (for example `leg-raise` mapping to the current Dragon Flag block). This is safe for current execution but should be cleaned up before any schema migration.
5. The analytics layer is useful for event capture, but meaningful product analytics require a real remote sink such as PostHog configured in production.

## Training / programming audit
The current week is coherent with an upper-body calisthenics priority and keeps the athlete's preferred EMOM structure. It also separates skill, strength, hypertrophy, and power roles better than earlier versions.

The main caution is workload concentration. The current simulator reports very high adjusted-load values on Push B and Push C and notable grip demand on all three Pull days. This aligns with the athlete's beta feedback: persistent DOMS, forearm fatigue, and later-set ROM degradation.

Recommended interpretation:
- keep OAP / Front Lever / high-skill work protected;
- use EMOM as a density tool, not as a claim of superior hypertrophy stimulus;
- preserve 120–180s accessory/compound rests and 180–240s skill rests when performance quality needs to stay high;
- on Pull days use non-grip-dependent core choices;
- add volume only when performance remains stable across comparable exposures.

## UX / UI audit
Strengths:
- clear Today / Plan / Reports / Settings navigation;
- focused workout player;
- explicit target range vs current goal;
- historical comparison is visible;
- draft/resume and skip/modified states are supported;
- Coach decisions are shown per exercise.

Remaining UX risks:
- too much secondary information can accumulate in the workout player on small screens;
- `program validation score` can look more precise than it is;
- the distinction between `last set` and `last exposure` should remain explicit everywhere;
- modified/substituted exercises should visually identify both the prescribed exercise and the executed substitute.

## Analytics audit
Track at minimum:
- workout start/complete/abandon;
- exercise start/complete/skip/substitute;
- timer complete/skip;
- Coach proposal view/accept/reject;
- Plan edit open/save;
- readiness submit/skip.

The current event design is sufficient to answer feature-adoption and friction questions once events are sent to a remote analytics sink.

## Evidence-based training baseline
Current evidence supports resistance training for hypertrophy and strength, higher weekly volume generally helps hypertrophy up to diminishing returns, and complete ROM plus appropriate loading are useful priorities. Proximity to failure matters more clearly for hypertrophy than for strength, but routine momentary failure is not required. Inter-set rest longer than 60 seconds may offer a small hypertrophic advantage, with diminishing differences beyond about 90 seconds in the current meta-analytic evidence.

## Final verdict
Product architecture: strong.
Workout UX: good, with minor density/clarity refinements.
Coach logic: substantially improved, but should not treat heuristic workload/recovery numbers as physiological truth.
Training program: appropriate for the stated upper-body calisthenics goals, but current Push/Pull density deserves monitoring and likely later fine-tuning after several weeks of normal adaptation rather than after one DOMS-heavy beta week.
Build status: the four user-reported TypeScript errors are fixed; a complete production build still needs to be verified in a fully installed Node environment.
