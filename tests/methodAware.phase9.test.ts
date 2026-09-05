import assert from "node:assert/strict";
import {buildAdaptivePeriodizedDay} from "../src/adaptiveProgramEngine.ts";
import {phasePlanFor} from "../src/periodizationEngine.ts";
import {PROGRAM} from "../src/program.ts";
import type {SessionSummary, WorkoutLog} from "../src/types.ts";

const phase=phasePlanFor("ACCUMULATION",1);
const monday=buildAdaptivePeriodizedDay(phase,"Monday",["oap","flpu","front_lever_touch","pushups","dips"],[]);
const push=monday.program.blocks.find(b=>b.id==="pushup-volume")!;
const dips=monday.program.blocks.find(b=>b.id==="dips-volume-a")!;

assert.equal(push.trainingMethod,"DENSITY_5X70");
assert.equal(push.sets,5);
assert.equal(push.target,"28");
assert.equal(push.rest,120);
assert.equal(push.densityProtocol?.fixedSets,5);
assert.equal(dips.trainingMethod,"DENSITY_5X70");
assert.equal(dips.target,"32");
assert.equal(dips.rest,120);

const mondayAgain=buildAdaptivePeriodizedDay(phase,"Monday",["oap","flpu","front_lever_touch","pushups","dips"],[
  {
    id:"s1",date:1000,day:"Monday",durationSec:3600,
    readiness:{energy:4},totalReps:140,emomReps:0,bestSkillSeconds:0,
    logs:[{
      id:"l1",sessionId:"s1",date:1000,day:"Monday",exerciseId:"pushup-long",
      exerciseName:"Push-up Long Set",variantId:"pushup-long",kind:"PERFORMANCE",status:"complete",
      result:{reps:[40],rir:2,fatigue:2}
    } as WorkoutLog]
  } as SessionSummary
]);
const push2=mondayAgain.program.blocks.find(b=>b.id==="pushup-volume")!;
assert.equal(push2.target,"28");
assert.equal(push2.sets,5);

console.log("method aware phase 9: ok");
