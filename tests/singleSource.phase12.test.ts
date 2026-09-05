import assert from "node:assert/strict";
import { PROGRAM, PROGRESSION_SPECS as PROGRAM_SPECS } from "../src/program.ts";
import {
  PROGRESSION_SPECS,
  progressionEntryForBlock,
  progressionKeyForExerciseId,
  criteriaForBlock,
  masteryCriteriaForBlock,
  progressionSpecForBlock,
  getProgressionSpec,
} from "../src/progressionRegistry.ts";
import { buildPeriodizedDay } from "../src/programBuilder.ts";
import { defaultPeriodizationCycle, phaseForCycleWeek } from "../src/periodizationEngine.ts";

assert.strictEqual(PROGRAM_SPECS, PROGRESSION_SPECS, "program must re-export the canonical registry object");
assert.equal(progressionKeyForExerciseId("pike-feet"), "pike");

const basePike = PROGRAM.Monday.blocks.find(b => b.id === "pike")!;
const entry = progressionEntryForBlock(basePike)!;
assert.equal(entry.current, "Pike Push-up");
assert.equal(getProgressionSpec("pike")?.next, entry.next);

const pikeCriteria = criteriaForBlock(basePike);
assert.equal(pikeCriteria.type, "reps");
assert.equal(pikeCriteria.minReps, 10);

const touch = PROGRAM.Tuesday.blocks.find(b => b.id === "touch")!;
const touchCriteria = criteriaForBlock(touch);
assert.deepEqual(touchCriteria, {
  type: "seconds",
  minHolds: 4,
  minSeconds: 4,
  minRir: 1,
  requireClean: true,
  consecutiveSessions: 2,
});

const touchMastery = masteryCriteriaForBlock(touch);
assert.equal(touchMastery.type, "seconds");
assert.equal(touchMastery.minSeconds, 8);
assert.equal(touchMastery.consecutiveSessions, 3);

const spec = progressionSpecForBlock(touch);
assert.equal(spec.targetProgression.maxIncrement, 1);
assert.equal(spec.variantMastery.nextVariantId, "touch");

const phase = phaseForCycleWeek(defaultPeriodizationCycle(), 1);
const built = buildPeriodizedDay({ phase, day: "Tuesday", goals: ["front_lever_touch"] });
const builtTouch = built.blocks.find(b => b.id === "touch")!;
assert.equal(builtTouch.progressionSpecId, "touch");
assert.equal(progressionEntryForBlock(builtTouch)?.current, "Front Touch");

console.log("phase 12 single source of truth: ok");
