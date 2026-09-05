import assert from "node:assert/strict";
import { buildCoachWeeklyReport, formatCoachWeeklyReport } from "../src/coachWeeklyIntelligence.ts";
import { defaultPeriodizationCycle, phaseForCycleWeek } from "../src/periodizationEngine.ts";
import type { SessionSummary, WorkoutLog } from "../src/types.ts";

function log(id:string,date:number,reps:number[],rir=2,fatigue=3):WorkoutLog{
  return {
    id,sessionId:id,date,day:"Thursday",exerciseId:"oap",exerciseName:"One Arm Pull-up",variantId:"oap",
    kind:"SKILL_REPS",status:"complete",
    prescription:{version:1,exerciseId:"oap",variantId:"oap",variantName:"One Arm Pull-up",name:"One Arm Pull-up",kind:"SKILL_REPS",targetRange:"1–2 / arm",sets:6,restSec:240,capturedAt:date},
    result:{reps,sides:["R","L","R","L","R","L"],rir,fatigue}
  };
}

const start=10*86400000;
const sessions:SessionSummary[]=Array.from({length:5},(_,i)=>({
  id:"s"+i,date:start+i*86400000+3600000,day:"Thursday",durationSec:3000,
  readiness:{sleepHours:8,energy:4},logs:[log("l"+i,start+i*86400000+3600000,i<4?[1,1,1,1,1,1]:[1,2,2,2,2,2])],
  totalReps:7,emomReps:0,bestSkillSeconds:0
}));

const phase=phaseForCycleWeek(defaultPeriodizationCycle(),1);
const report=buildCoachWeeklyReport(sessions,phase,start+5*86400000+7200000);

assert.equal(report.sessions,5);
assert.equal(report.adherencePct,71);
assert.equal(report.totalReps,35);
assert.equal(report.effortCoveragePct,100);
assert.ok(report.goals.some(g=>g.goalId==="oap"));
assert.equal(report.plateauCount,0);
assert.ok(report.headline.length>0);
assert.ok(formatCoachWeeklyReport(report).includes("COACH VERDICT:"));

const plateauSessions:SessionSummary[]=Array.from({length:3},(_,i)=>({
  ...sessions[i],date: start+i*86400000+3600000,
  logs:[log("p"+i,start+i*86400000+3600000,[1,2,1,1,1,1])]
}));
const plateau=buildCoachWeeklyReport(plateauSessions,phase,start+3*86400000+7200000);
assert.equal(plateau.plateauCount,1);
assert.ok(plateau.actions.some(a=>a.exerciseId==="oap"));

console.log("phase 13 weekly intelligence: ok");
