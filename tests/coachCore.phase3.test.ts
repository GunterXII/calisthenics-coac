import { strict as assert } from "node:assert";
import { runCoachCore, isSafeProgressionProposal } from "../src/coachCore.ts";
import { PROGRAM } from "../src/program.ts";
import type { SessionSummary, WorkoutLog } from "../src/types.ts";

const pike=PROGRAM.Monday.blocks.find(b=>b.id==="pike")!;
const ready={energy:5,sleepHours:8,wristPain:0,elbowPain:0};

function log(id:string,date:number,reps:number[],rir=2):WorkoutLog{
  return {
    id,sessionId:`s-${id}`,date,day:"Monday",exerciseId:pike.id,exerciseName:pike.name,variantId:pike.id,variantName:pike.name,kind:pike.kind,status:"complete",
    prescription:{version:1,exerciseId:pike.id,variantId:pike.id,variantName:pike.name,name:pike.name,kind:pike.kind,targetRange:pike.target,sets:pike.sets,restSec:pike.rest,progressionMode:pike.progressionMode,capturedAt:date},
    result:{reps,rir,quality:reps.map(()=>"Clean")}
  };
}
function session(id:string,date:number,logs:WorkoutLog[]):SessionSummary{
  return {id,date,day:"Monday",durationSec:3600,readiness:ready,logs,totalReps:logs.reduce((n,l)=>n+(l.result.reps||[]).reduce((a,b)=>a+b,0),0),emomReps:0,bestSkillSeconds:0};
}

// One good exposure must NOT produce a proposal.
{
  const current=log("current",300,[10,10,10],2);
  const result=runCoachCore({session:session("current-session",300,[current]),history:[],blocks:[pike]});
  assert.equal(result.analyses[0]?.action,"HOLD");
  assert.equal(result.proposals.length,0);
}

// Two comparable qualifying exposures may unlock the target progression.
{
  const previous=log("previous",100,[10,10,10],2);
  const current=log("current",300,[10,10,10],2);
  const result=runCoachCore({session:session("current-session",300,[current]),history:[session("previous-session",100,[previous])],blocks:[pike]});
  assert.equal(result.analyses[0]?.action,"PROGRESS");
  assert.equal(result.analyses[0]?.streak,2);
  assert.equal(result.analyses[0]?.proposedTarget,"7–11");
  assert.equal(result.proposals.length,1);
  assert.equal(isSafeProgressionProposal(result.proposals[0]),true);
}

// A modified exposure is review-only and must never be used as progression evidence.
{
  const modified={...log("modified",300,[10,10,10],2),status:"modified" as const,modification:"Feet elevated"};
  const result=runCoachCore({session:session("modified-session",300,[modified]),history:[],blocks:[pike]});
  assert.equal(result.analyses[0]?.action,"REVIEW");
  assert.equal(result.proposals.length,0);
}

// Recovery is allowed to produce a review proposal, but it must not silently mutate the plan.
{
  const current=log("fatigued",300,[10,10,10],2);
  current.result.fatigue=5;
  const result=runCoachCore({session:session("fatigue-session",300,[current]),history:[],blocks:[pike]});
  assert.equal(result.analyses[0]?.action,"REDUCE_VOLUME");
  assert.equal(result.proposals[0]?.type,"program_review");
}

console.log("Phase 3 Coach Core tests: PASS");
