import assert from "node:assert/strict";
import {PROGRAM} from "../src/program.ts";
import {decideExerciseInContext} from "../src/coachEngineV2.ts";
import type {SessionSummary, WorkoutLog} from "../src/types.ts";

function log(id:string, exerciseId:string, reps:number[], sessionId:string, opts:any={}):WorkoutLog{
  const block=Object.values(PROGRAM).flatMap(p=>p.blocks).find(b=>b.id===exerciseId)!;
  const sessionDate = sessionId==="s1" ? Date.now()-10*86400000 : sessionId==="s2" ? Date.now()-7*86400000 : Date.now();
  return {id,sessionId: sessionId.replace("s1","s1").replace("s2","s2").replace("s3","s3").replace("s4","s4"),date:sessionDate,day:"Monday",exerciseId,exerciseName:block.name,variantId:exerciseId,variantName:block.name,kind:block.kind,status:"complete",prescription:{version:1,exerciseId,variantId:exerciseId,variantName:block.name,name:block.name,kind:block.kind,targetRange:block.target,sets:block.sets,minutes:block.minutes,restSec:block.rest,bandOptions:block.bandOptions,defaultBand:block.defaultBand,progressionMode:block.progressionMode,fatigueCost:block.fatigueCost,muscleGroups:block.muscleGroups,effectiveSetWeight:block.effectiveSetWeight,gripDemand:block.gripDemand,capturedAt:Date.now()},result:{reps,...opts}};
}

const b=PROGRAM.Monday.blocks.find(x=>x.id==="pushup-volume")!;
const s1:SessionSummary={id:"s1",date:Date.now()-10*86400000,day:"Monday",durationSec:300,readiness:{sleepHours:8,energy:5,wristPain:0,elbowPain:0},logs:[log("l1",b.id,[20,20,20],"s1",{rir:2,fatigue:2})],totalReps:60,emomReps:0,bestSkillSeconds:0};
const s2:SessionSummary={id:"s2",date:Date.now()-3*86400000,day:"Monday",durationSec:300,readiness:{sleepHours:8,energy:5,wristPain:0,elbowPain:0},logs:[log("l2",b.id,[20,20,20],"s2",{rir:2,fatigue:2})],totalReps:60,emomReps:0,bestSkillSeconds:0};
const s3:SessionSummary={id:"s3",date:Date.now(),day:"Monday",durationSec:300,readiness:{sleepHours:8,energy:5,wristPain:0,elbowPain:0},logs:[log("l3",b.id,[20,20,20],"s3",{rir:2,fatigue:2})],totalReps:60,emomReps:0,bestSkillSeconds:0};
const decision=decideExerciseInContext(b,s3.logs[0],[s1,s2,s3]);
assert.equal(decision.comparableExposure,true);
assert.ok(decision.progressionStreak>=2);
assert.equal(decision.decision,"PROGRESS");
const tired:SessionSummary={...s3,id:"s4",logs:[log("l4",b.id,[20,18,15],"s4",{rir:1,fatigue:5})],readiness:{sleepHours:6,energy:2,wristPain:0,elbowPain:0}};
const tiredDecision=decideExerciseInContext(b,tired.logs[0],[s1,s2,tired]);
assert.ok(["HOLD","REDUCE_VOLUME"].includes(tiredDecision.decision));
assert.ok(tiredDecision.reasons.some(x=>x.toLowerCase().includes("readiness")||x.toLowerCase().includes("fatigue")));
console.log("Phase 10 Coach Engine tests: PASS");
