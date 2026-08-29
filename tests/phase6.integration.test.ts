import { strict as assert } from "node:assert";
import { shouldRestAfterStandardSet, shouldRestAfterSideSet, totalSessionReps, isComparableExposure } from "../src/workoutEngine.ts";
import { latestLog } from "../src/storage.ts";
import { evaluateProgression, criteriaForBlock } from "../src/coachingEngine.ts";
import { PROGRAM } from "../src/program.ts";

assert.equal(shouldRestAfterStandardSet(1,3),true);
assert.equal(shouldRestAfterStandardSet(2,3),true);
assert.equal(shouldRestAfterStandardSet(3,3),false);
assert.equal(shouldRestAfterStandardSet(4,3),false);

assert.equal(shouldRestAfterSideSet(1,4,"R"),false);
assert.equal(shouldRestAfterSideSet(2,4,"L"),true);
assert.equal(shouldRestAfterSideSet(4,4,"L"),false);

const logs:any[]=[
 {status:"complete",result:{reps:[10,10]}},
 {status:"complete",result:{emom:[5,5]}},
 {status:"skipped",result:{note:"skip"}},
];
assert.equal(totalSessionReps(logs as any),30);

assert.equal(isComparableExposure({...logs[0],status:"complete"} as any),true);
assert.equal(isComparableExposure({...logs[0],status:"modified"} as any),false);
assert.equal(isComparableExposure({...logs[0],status:"incomplete"} as any),false);

const push=PROGRAM.Wednesday.blocks.find(b=>b.id==="pushup-emom-b")!;
const modified:any={exerciseId:push.id,status:"modified",result:{emom:[10,10,10,10,10,10,10,10,10,10],rir:2},session:{readiness:{energy:5,sleepHours:8,wristPain:0,elbowPain:0},date:Date.now()}};
const evaluation=evaluateProgression(push,modified,criteriaForBlock(push));
assert.equal(evaluation.qualifies,false);
assert.equal(evaluation.decision,"HOLD");
assert.equal(evaluation.comparableExposure,false);

console.log("Phase 6 integration tests: PASS");
