import { strict as assert } from "node:assert";
import { PROGRAM } from "../src/program.ts";
import { trainingProfileForBlock, effectiveWorkloadSets, sessionWorkloadByMuscle } from "../src/trainingModel.ts";
import type { PrescriptionSnapshot } from "../src/types.ts";

const pike = PROGRAM.Monday.blocks.find(b => b.id === "pike")!;
const dips = PROGRAM.Wednesday.blocks.find(b => b.id === "dips-emom-b")!;
const oap = PROGRAM.Thursday.blocks.find(b => b.id === "oap")!;
const dragon = PROGRAM.Thursday.blocks.find(b => b.id === "leg-raise")!;
const legs = PROGRAM.Sunday.blocks.find(b => b.id === "bulgarian")!;

assert.equal(trainingProfileForBlock(pike).role, "strength");
assert.equal(trainingProfileForBlock(pike).progressionMode, "strength_reps");
assert.equal(trainingProfileForBlock(dips).progressionMode, "density_emom");
assert.equal(trainingProfileForBlock(oap).gripDemand, "high");
assert.equal(trainingProfileForBlock(dragon).gripDemand, "none");
assert.equal(trainingProfileForBlock(legs).muscleGroups.includes("quads"), true);

for (const day of Object.keys(PROGRAM)) {
  for (const block of PROGRAM[day as keyof typeof PROGRAM].blocks) {
    const profile = trainingProfileForBlock(block);
    assert.ok(profile.fatigueCost >= 1 && profile.fatigueCost <= 5);
    assert.ok(profile.effectiveSetWeight >= 0 && profile.effectiveSetWeight <= 1);
    assert.ok(Array.isArray(profile.muscleGroups));
  }
}

assert.equal(effectiveWorkloadSets(pike, 3), 2.4);
assert.equal(effectiveWorkloadSets(dips, 10), 9);

const totals = sessionWorkloadByMuscle([pike, dips, legs], { pike: 3, "dips-emom-b": 10, bulgarian: 3 });
assert.ok((totals.triceps || 0) > 0);
assert.ok((totals.quads || 0) > 0);
assert.ok((totals.chest || 0) > 0);

console.log("Phase 7 Training Model tests: PASS");

const snapshot: PrescriptionSnapshot = { version:1, exerciseId:oap.id, variantId:oap.id, variantName:oap.name, name:oap.name, kind:oap.kind, targetRange:oap.target, sets:oap.sets, restSec:oap.rest, progressionMode:trainingProfileForBlock(oap).progressionMode, fatigueCost:trainingProfileForBlock(oap).fatigueCost, muscleGroups:trainingProfileForBlock(oap).muscleGroups, effectiveSetWeight:trainingProfileForBlock(oap).effectiveSetWeight, gripDemand:trainingProfileForBlock(oap).gripDemand, capturedAt:Date.now() };
assert.equal(snapshot.gripDemand, "high");
assert.equal(snapshot.fatigueCost, 5);
