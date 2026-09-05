import assert from "node:assert/strict";
import {detectPlateaus} from "../src/plateauEngine.ts";
import type {SessionSummary,WorkoutLog} from "../src/types.ts";

const make=(id:string,date:number,target="1–2 / arm",reps:number[],fatigue=3):WorkoutLog=>({
 id,sessionId:id,date,day:"Thursday",exerciseId:"oap",exerciseName:"One Arm Pull-up",variantId:"oap",kind:"SKILL_REPS",status:"complete",
 prescription:{version:1,exerciseId:"oap",variantId:"oap",variantName:"One Arm Pull-up",name:"One Arm Pull-up",kind:"SKILL_REPS",targetRange:target,sets:6,restSec:240,capturedAt:date},
 result:{reps,rir:0,fatigue}
});

const sessions:SessionSummary[]=[1,2,3].map((n)=>({
 id:"s"+n,date:n*1000,day:"Thursday",durationSec:3000,readiness:{energy:4},totalReps:7,emomReps:0,bestSkillSeconds:0,
 logs:[make("l"+n,n*1000,"1–2 / arm",[1,2,1,1,1,1])]
}));
const signals=detectPlateaus(sessions);
assert.equal(signals.length,1);
assert.equal(signals[0].exerciseId,"oap");
assert.equal(signals[0].recommendation,"CONSIDER_CLUSTER");

const improved:SessionSummary={...sessions[0],id:"s4",date:4000,logs:[make("l4",4000,"1–2 / arm",[1,2,2,2,1,2])]};
assert.equal(detectPlateaus([...sessions,improved]).length,0);

const tired:SessionSummary={...sessions[2],id:"s5",date:5000,logs:[make("l5",5000,"1–2 / arm",[1,1,1,1,1,1],5)]};
assert.equal(detectPlateaus([sessions[0],sessions[1],tired]).length,0);

console.log("plateau phase 11: ok");
