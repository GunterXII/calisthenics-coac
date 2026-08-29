import assert from "node:assert/strict";
import { weeklyWorkload, sessionWorkload, workloadForLog, recoveryForMuscle } from "../src/workloadEngine.ts";
import type { SessionSummary, WorkoutLog } from "../src/types.ts";
import { PROGRAM } from "../src/program.ts";

const now=Date.now();
function log(overrides:Partial<WorkoutLog>):WorkoutLog{
  return {
    id:Math.random().toString(),sessionId:"s1",date:now,day:"Thursday",exerciseId:"oap",exerciseName:"One Arm Pull-up",kind:"SKILL_REPS",status:"complete",
    prescription:{version:1,exerciseId:"oap",variantId:"oap",variantName:"One Arm Pull-up",name:"One Arm Pull-up",kind:"SKILL_REPS",targetRange:"1–2 / arm",sets:6,restSec:240,fatigueCost:5,muscleGroups:["lats","upper_back","biceps","forearms","core"],effectiveSetWeight:.35,gripDemand:"high",capturedAt:now},
    result:{reps:[1,1,1,1,1,1],rir:2,band:"None"},...overrides,
  };
}
const s:SessionSummary={id:"s1",date:now,day:"Thursday",durationSec:3600,readiness:{energy:4},logs:[log({})],totalReps:6,emomReps:0,bestSkillSeconds:0};

const w=sessionWorkload(s);
assert.equal(w.day,"Thursday");
assert.ok(w.totalAdjustedSets>0);
assert.ok((w.muscles.lats?.fatigueLoad||0)>0);
assert.ok(w.grip.score>0);

const broken=log({status:"skipped",result:{}});
assert.equal(workloadForLog(broken),undefined);

const report=weeklyWorkload([s],now);
assert.equal(report.sessions,1);
assert.ok(report.muscles.lats.adjustedSets>0);
assert.ok(report.recovery.lats.recentLoad>0);

const delayed={...s,id:"s2",date:now-72*3600000,logs:[log({sessionId:"s2",date:now-72*3600000})]};
const recent=recoveryForMuscle("lats",[s],now);
const older=recoveryForMuscle("lats",[delayed],now);
assert.ok(recent.recentLoad>older.recentLoad);

assert.equal(PROGRAM.Thursday.blocks.some(b=>b.name==="Dragon Flag"),true);
console.log("Phase 8 Workload & Recovery tests: PASS");
