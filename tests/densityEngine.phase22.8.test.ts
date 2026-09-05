import assert from "node:assert/strict";
import {PROGRAM} from "../src/program.ts";
import {densityReferenceMax,densityTargetReps,resolveDensityPrescription} from "../src/densityEngine.ts";
import {phasePlanFor} from "../src/periodizationEngine.ts";
import {buildAdaptivePeriodizedDay} from "../src/adaptiveProgramEngine.ts";
import {proposeDensityRestProgression} from "../src/methodAwareCoaching.ts";
import type {SessionSummary,WorkoutLog} from "../src/types.ts";

const pushDensity=PROGRAM.Monday.blocks.find(b=>b.id==="pushup-volume")!;
const pushLong=PROGRAM.Friday.blocks.find(b=>b.id==="pushup-long")!;

function log(id:string,exerciseId:string,date:number,reps:number[],rest=120):WorkoutLog{
  const block=Object.values(PROGRAM).flatMap(d=>d.blocks).find(b=>b.id===exerciseId)!;
  return {
    id,sessionId:id,date,day:exerciseId.includes("long")?"Friday":"Monday",exerciseId,exerciseName:block.name,
    variantId:exerciseId,variantName:block.name,kind:block.kind,status:"complete",
    prescription:{version:1,exerciseId,variantId:exerciseId,variantName:block.name,name:block.name,kind:block.kind,targetRange:exerciseId===pushLong.id?block.target:"32–32",sets:block.sets,restSec:rest,trainingMethod:block.trainingMethod,densityProtocol:block.densityProtocol,capturedAt:date},
    result:{reps,quality:[...reps.map(()=>"Clean" as const)],rir:2,fatigue:2},
  };
}

const empty:SessionSummary[]=[];
assert.equal(densityReferenceMax(pushDensity,empty),40);
assert.equal(densityTargetReps(pushDensity,empty),28);
assert.equal(resolveDensityPrescription(pushDensity,empty).sets,5);
assert.equal(resolveDensityPrescription(pushDensity,empty).target,"28–28");
assert.equal(resolveDensityPrescription(pushDensity,empty).rest,120);

const fortyFive=log("long-45",pushLong.id,1000,[45],180);
const sessions=[{id:"s1",date:1000,day:"Friday",durationSec:300,readiness:{},logs:[fortyFive],totalReps:45,emomReps:0,bestSkillSeconds:0} as SessionSummary];
assert.equal(densityReferenceMax(pushDensity,sessions),45);
assert.equal(densityTargetReps(pushDensity,sessions),32);
assert.equal(resolveDensityPrescription(pushDensity,sessions).target,"32–32");
assert.equal(resolveDensityPrescription(pushDensity,sessions).sets,5);
assert.equal(resolveDensityPrescription(pushDensity,sessions).rest,120);

const densityOne=log("density-1",pushDensity.id,2000,[32,32,32,31,31],120);
const withDensity=[...sessions,{id:"s2",date:2000,day:"Monday",durationSec:600,readiness:{},logs:[densityOne],totalReps:158,emomReps:0,bestSkillSeconds:0} as SessionSummary];
assert.equal(resolveDensityPrescription(pushDensity,withDensity).target,"32–32");
assert.equal(resolveDensityPrescription(pushDensity,withDensity).rest,120);

const densityTwo=log("density-2",pushDensity.id,3000,[32,32,32,32,32],120);
const proposal=proposeDensityRestProgression(pushDensity,densityTwo,[densityOne]);
assert.equal(proposal?.type,"rest");
assert.equal(proposal?.from,"120s");
assert.equal(proposal?.to,"105s");
const afterRest=[...withDensity,{id:"s4",date:3000,day:"Monday",durationSec:600,readiness:{},logs:[densityTwo],totalReps:160,emomReps:0,bestSkillSeconds:0} as SessionSummary];
assert.equal(resolveDensityPrescription(pushDensity,afterRest).rest,120);
const densityThree=log("density-3",pushDensity.id,4000,[32,32,32,31,31],105);
const afterAccepted=[...afterRest,{id:"s5",date:4000,day:"Monday",durationSec:600,readiness:{},logs:[densityThree],totalReps:158,emomReps:0,bestSkillSeconds:0} as SessionSummary];
assert.equal(resolveDensityPrescription(pushDensity,afterAccepted).rest,105);

const fifty=log("long-50",pushLong.id,3000,[50],180);
const newMax=[...withDensity,{id:"s3",date:3000,day:"Friday",durationSec:300,readiness:{},logs:[fifty],totalReps:50,emomReps:0,bestSkillSeconds:0} as SessionSummary];
assert.equal(densityReferenceMax(pushDensity,newMax),50);
assert.equal(densityTargetReps(pushDensity,newMax),35);
// A new reference max creates a new density target; restart the rest ladder from its initial dose.
assert.equal(resolveDensityPrescription(pushDensity,newMax).target,"35–35");
assert.equal(resolveDensityPrescription(pushDensity,newMax).rest,120);

const plan=buildAdaptivePeriodizedDay(phasePlanFor("ACCUMULATION",2),"Monday",["pushups"],withDensity,4000);
const planned=plan.program.blocks.find(b=>b.id===pushDensity.id)!;
assert.equal(planned.sets,5,"DENSITY_5X70 keeps its fixed five-set dose through periodization/adaptation");
assert.equal(planned.target,"32–32");

console.log("Phase 22.8 density auto-prescription tests: PASS");
