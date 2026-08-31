import assert from "node:assert/strict";
import {canonicalizeWorkoutLog, validateWorkoutLog, validateSession, toSetRecords} from "../src/dataFoundation.ts";
import type {WorkoutLog, SessionSummary} from "../src/types.ts";

const base: WorkoutLog = {
  id: "log-1", sessionId: "session-1", date: 1000, day: "Monday",
  exerciseId: "oap", exerciseName: "One Arm Pull-up", variantId: "oap-assisted",
  variantName: "Assisted OAP", kind: "PERFORMANCE", status: "complete",
  result: {reps: [0, 2, 1], rir: 1, fatigue: 4, quality: ["Lost position", "Shaky", "Clean"]}
};

const records = toSetRecords(base);
assert.deepEqual(records.map(x => x.reps), [0, 2, 1]);
assert.equal(records[0]?.failed, true);
assert.equal(records[2]?.quality, "Clean");

const canonical = canonicalizeWorkoutLog(base);
assert.equal(canonical.skipped, false);
assert.equal(canonical.variantId, "oap-assisted");
assert.equal(canonical.sets.length, 3);

const skipped: WorkoutLog = {...base, id: "log-2", status: "skipped", skipped: true, result: {reps: [0]}};
assert.equal(canonicalizeWorkoutLog(skipped).skipped, true);
assert.equal(canonicalizeWorkoutLog(skipped).sets[0]?.reps, 0);

const invalid: WorkoutLog = {...base, result: {reps: [-1, Number.NaN], rir: 4}};
const invalidResult = validateWorkoutLog(invalid);
assert.equal(invalidResult.valid, false);
assert.ok(invalidResult.errors.some(x => x.includes("negative")));
assert.ok(invalidResult.errors.some(x => x.includes("RIR")));

const session: SessionSummary = {
  id: "session-1", date: 1000, day: "Monday", durationSec: 3600,
  readiness: {sleepHours: 7.5, energy: 4, wristPain: 0, elbowPain: 0, weightKg: 80},
  logs: [base], totalReps: 3, emomReps: 0, bestSkillSeconds: 0, sessionFatigue: 4
};
assert.equal(validateSession(session).valid, true);

const badSession: SessionSummary = {...session, durationSec: -1};
assert.equal(validateSession(badSession).valid, false);

console.log("data foundation phase 1: ok");
