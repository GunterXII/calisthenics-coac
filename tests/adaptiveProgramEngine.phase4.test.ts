import { strict as assert } from 'node:assert';
import { PROGRAM } from '../src/program.ts';
import { buildAdaptivePeriodizedDay } from '../src/adaptiveProgramEngine.ts';
import { phasePlanFor } from '../src/periodizationEngine.ts';
import type { SessionSummary } from '../src/types.ts';

const now = Date.now();
const emptyReadiness = {sleepHours:8,energy:5,wristPain:0,elbowPain:0,weightKg:80};
function session(id:string, date:number, day:any, log:any):SessionSummary {
  return {id,date,day,durationSec:3600,readiness:emptyReadiness,logs:[{...log,sessionId:id,date,day}],totalReps:100,emomReps:0,bestSkillSeconds:10};
}

const monday = PROGRAM.Monday.blocks.find(b=>b.id==='pushup-volume')!;
const good1 = session('s1',now-3*86400000,'Monday',{id:'l1',exerciseId:monday.id,exerciseName:monday.name,kind:monday.kind,status:'complete',prescription:{version:1,exerciseId:monday.id,variantId:monday.id,variantName:monday.name,name:monday.name,kind:monday.kind,targetRange:monday.target,sets:monday.sets,restSec:monday.rest,progressionMode:monday.progressionMode,fatigueCost:monday.fatigueCost,muscleGroups:monday.muscleGroups,effectiveSetWeight:monday.effectiveSetWeight,gripDemand:monday.gripDemand,capturedAt:now-3*86400000},result:{reps:[28,28,28,28,28],rir:2,quality:['Clean','Clean','Clean','Clean','Clean']}});
const plan = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['oap','flpu','front_lever_touch','pushups','dips'],[good1],now);
const decision = plan.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.equal(decision.action,'NONE');
assert.equal(plan.program.blocks.find(b=>b.id==='pushup-volume')!.sets!,5);
assert.equal(plan.program.blocks.find(b=>b.id==='pushup-volume')!.target,'28–28');

const tiredSession = session('s2',now-24*3600000,'Monday',{id:'l2',exerciseId:monday.id,exerciseName:monday.name,kind:monday.kind,status:'complete',prescription:{version:1,exerciseId:monday.id,variantId:monday.id,variantName:monday.name,name:monday.name,kind:monday.kind,targetRange:monday.target,sets:monday.sets,restSec:monday.rest,progressionMode:monday.progressionMode,fatigueCost:monday.fatigueCost,muscleGroups:monday.muscleGroups,effectiveSetWeight:monday.effectiveSetWeight,gripDemand:monday.gripDemand,capturedAt:now-86400000},result:{reps:[8,8,8],rir:0,quality:['Shaky','Shaky','Shaky']}});
const tiredPlan = buildAdaptivePeriodizedDay(phasePlanFor('ACCUMULATION',2),'Monday',['pushups'],[tiredSession],now);
const tiredDecision = tiredPlan.decisions.find(d=>d.exerciseId==='pushup-volume')!;
assert.ok(['HOLD','REDUCE_VOLUME','REDUCE_DENSITY'].includes(tiredDecision.action));

const endurance = buildAdaptivePeriodizedDay(phasePlanFor('ENDURANCE_EMPHASIS',2),'Friday',['pushups','dips'],[],now);
assert.ok(endurance.program.blocks.some(b=>b.kind==='EMOM'));
console.log('Phase 4 Adaptive Program tests: PASS');
