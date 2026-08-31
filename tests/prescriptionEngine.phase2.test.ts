import assert from "node:assert/strict";
import {applyProgramOverride,captureHistoricalPrescription,capturePrescriptionSnapshot,parsePrescriptionRange,prescriptionChanged,resolveEffectivePrescription,snapshotSummary} from "../src/prescriptionEngine.ts";
import type {ExerciseBlock,ProgramOverride} from "../src/types.ts";

const base:ExerciseBlock={
  id:"close-chin",
  catalogExerciseId:"close-chin",
  kind:"EMOM",
  name:"Close-Grip Chin-up",
  detail:"10 min EMOM",
  target:"4–7/min",
  rest:60,
  minutes:10,
  sets:undefined,
  bandOptions:["None"],
  defaultBand:"None",
  progressionMode:"density_emom",
  fatigueCost:3,
};

assert.deepEqual(parsePrescriptionRange("4–7/min"),{min:4,max:7,suffix:"/min"});
assert.deepEqual(parsePrescriptionRange("6–10s"),{min:6,max:10,suffix:"s"});
assert.equal(parsePrescriptionRange("max sec"),undefined);

const override:ProgramOverride={exerciseId:"close-chin",variantId:"chest-chin",target:"5–8/min",minutes:12,updatedAt:200};
const staleToday=resolveEffectivePrescription(base,{"close-chin":override},{value:7,updatedAt:199});
assert.equal(staleToday.todayTarget,undefined);
assert.equal(staleToday.block.minutes,12);
assert.equal(staleToday.block.target,"5–8/min");
assert.equal(staleToday.targetSource,"PROGRAM_DEFAULT");

const freshToday=resolveEffectivePrescription(base,{"close-chin":override},{value:7,updatedAt:200});
assert.equal(freshToday.todayTarget,7);
assert.equal(freshToday.targetSource,"TODAY_TARGET");

const clampedToday=resolveEffectivePrescription(base,{"close-chin":override},{value:99,updatedAt:201});
assert.equal(clampedToday.todayTarget,8);

const unchanged=applyProgramOverride(base,undefined);
assert.deepEqual(unchanged,base);
const changed=applyProgramOverride(base,override);
assert.equal(changed.minutes,12);
assert.equal(changed.name,"Close-Grip Chin-up");

const captured=capturePrescriptionSnapshot(changed,{todayTarget:7,variantId:"chest-chin",variantName:"Chest-to-Bar Chin-up",capturedAt:123});
assert.equal(captured.variantId,"chest-chin");
assert.equal(captured.variantName,"Chest-to-Bar Chin-up");
assert.equal(captured.todayTarget,7);
assert.equal(captured.minutes,12);
assert.equal(captured.capturedAt,123);

const historical=captureHistoricalPrescription(changed,{id:"old-variant",name:"Executed Variant"},6,456);
assert.equal(historical.variantId,"old-variant");
assert.equal(historical.variantName,"Executed Variant");
assert.equal(historical.capturedAt,456);

const changedSnapshot={...captured,todayTarget:8};
assert.equal(prescriptionChanged(captured,changedSnapshot),true);
assert.equal(prescriptionChanged(captured,captured),false);
assert.equal(snapshotSummary(captured),"12 min EMOM · target 7/min · 60s rest");

console.log("prescription engine phase 2: ok");
