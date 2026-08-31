import { strict as assert } from 'node:assert';
import { PROGRAM } from '../src/program.ts';
import { buildAdaptivePeriodizedDay } from '../src/adaptiveProgramEngine.ts';
import { phasePlanFor } from '../src/periodizationEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const now = Date.now();
const readiness = {sleepHours:8,energy:5,wristPain:0,elbowPain:0,weightKg:80};
function session(id:string,date:number,day:any,log:any):SessionSummary {
  return {id,date,day,durationSec:3600,readiness,logs:[{...log,sessionId:id,date,day}],totalReps:100,emomReps:0,bestSkillSeconds:10};
}
function makePushLog(id:string, reps:number[], date:number){
  const b=PROGRAM.Monday.blocks.find(x=>x.id==='pushup-volume')!;
  return session(id,date,'Monday',{id:`${id}-log`,exerciseId:b.id,exerciseName:b.name,kind:b.kind,status:'complete',prescription:{version:1,exerciseId:b.id,variantId:b.id,variantName:b.name,name:b.name,kind:b.kind,targetRange:b.target,sets:b.sets,restSec:b.rest,progressionMode:b.progressionMode,fatigueCost:b.fatigueCost,muscleGroups:b.muscleGroups,effectiveSetWeight:b.effectiveSetWeight,gripDemand:b.gripDemand,capturedAt:date},result:{reps,rir:2,quality:reps.map(()=> 'Clean')}});
}

const monday = PROGRAM.Monday.blocks.find(b=>b.id==='pushup-volume')!;
const oneGood = makePushLog('s1',[20,20,20],now-6*86400000);
const planOne = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[oneGood],now);
const oneDecision = planOne.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.equal(oneDecision.evidenceExposures,1);
assert.equal(oneDecision.action,'HOLD');

const twoGoodA = makePushLog('s2',[20,20,20],now-6*86400000);
const twoGoodB = makePushLog('s3',[20,20,20],now-3*86400000);
const planTwo = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[twoGoodA,twoGoodB],now);
const twoDecision = planTwo.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.equal(twoDecision.action,'ADD_VOLUME');
assert.equal(twoDecision.setsDelta,1);
assert.ok(planTwo.program.blocks.find(b=>b.id==='pushup-volume')!.sets! > monday.sets!);

const tiredSession = makePushLog('s4',[8,8,8],now-86400000);
const tiredPlan = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[tiredSession],now);
const tiredDecision = tiredPlan.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.ok(['HOLD','REDUCE_VOLUME','REDUCE_DENSITY'].includes(tiredDecision.action));

const painSession = makePushLog('s5',[20,20,20],now-86400000);
painSession.readiness={...readiness,wristPain:4};
const painPlan = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[painSession],now);
const painDecision = painPlan.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.equal(painDecision.action,'PROTECT');
assert.equal(painDecision.setsDelta,0);

const endurance = buildAdaptivePeriodizedDay(phasePlanFor('ENDURANCE_EMPHASIS',2),'Friday',['pushups','dips'],[],now);
assert.ok(endurance.program.blocks.some(b=>b.kind==='EMOM'));
console.log('Phase 4 Adaptive Program tests: PASS');
