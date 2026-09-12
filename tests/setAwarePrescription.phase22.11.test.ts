import { strict as assert } from 'node:assert';
import { PROGRAM } from '../src/program.ts';
import { buildAdaptivePeriodizedDay } from '../src/adaptiveProgramEngine.ts';
import { phasePlanFor } from '../src/periodizationEngine.ts';
import type { SessionSummary, ExerciseBlock } from '../src/types.ts';

const now = Date.now();
const readiness = {sleepHours:8,energy:5,wristPain:0,elbowPain:0,weightKg:80};

function session(id:string, date:number, block:ExerciseBlock, reps:number[], opts:any={}):SessionSummary {
  return {
    id,date,day:opts.day||'Monday',durationSec:3600,readiness,logs:[{
      id:`${id}-log`,sessionId:id,date,day:opts.day||'Monday',exerciseId:block.id,exerciseName:block.name,kind:block.kind,status:'complete',
      prescription:{version:1,exerciseId:block.id,variantId:block.id,variantName:block.name,name:block.name,kind:block.kind,targetRange:block.target,sets:block.sets,restSec:block.rest,progressionMode:block.progressionMode,trainingMethod:block.trainingMethod,fatigueCost:block.fatigueCost,muscleGroups:block.muscleGroups,effectiveSetWeight:block.effectiveSetWeight,gripDemand:block.gripDemand,capturedAt:date},
      result:{reps,rir:opts.rir??1,fatigue:opts.fatigue??3,quality:Array(reps.length).fill('Clean')},
    }],
    totalReps:reps.reduce((a,b)=>a+b,0),emomReps:0,bestSkillSeconds:0,
  };
}

const monday=PROGRAM.Monday.blocks.find(b=>b.id==='pike')!;
const week={...phasePlanFor('ACCUMULATION',2),fatigueBudget:100};

// 1) Sustainable repeated-set capacity: no unnecessary reduction.
const stable=session('stable',now-2*86400000,monday,[10,10,10],{rir:2,fatigue:2});
const stablePlan=buildAdaptivePeriodizedDay(week,'Monday',['pushups','dips'],[stable],now);
const stableDecision=stablePlan.decisions.find(d=>d.exerciseId==='pike')!;
assert.notEqual(stableDecision.action,'REDUCE_VOLUME');

// 2) Repeated-set capacity: first set strong, later sets collapse at low RIR.
const closePush=PROGRAM.Wednesday.blocks.find(b=>b.id==='diamond') || PROGRAM.Wednesday.blocks.find(b=>b.trainingRole==='hypertrophy'&&b.kind==='VOLUME_SKILL') || PROGRAM.Wednesday.blocks.find(b=>b.priority==='primary'&&b.trainingRole==='hypertrophy')!;
const collapse=session('collapse',now-86400000,closePush,[23,23,23,16,11],{rir:0,fatigue:4});
const collapsePlan=buildAdaptivePeriodizedDay(week,'Wednesday',['pushups','dips'],[collapse],now);
const collapseDecision=collapsePlan.decisions.find(d=>d.exerciseId===closePush.id)!;
assert.equal(collapseDecision.action,'REDUCE_VOLUME','large repeated-set drop-off at low RIR should reduce one set');
assert.equal(collapseDecision.setsDelta,-1);
assert.ok(collapseDecision.reason.includes('Repeated-set capacity') || collapseDecision.reason.includes('drop-off'));

// 3) A long-set collapse is treated as costly repeated exposure, not as proof that
// total reps should increase.
const long=PROGRAM.Friday.blocks.find(b=>b.trainingMethod==='LONG_SET' && b.id.endsWith('-long'))!;
const longCollapse=session('long-collapse',now-86400000,long,[42,22],{rir:0,fatigue:4});
const longPlan=buildAdaptivePeriodizedDay(week,'Friday',['pushups','dips'],[longCollapse],now);
const longDecision=longPlan.decisions.find(d=>d.exerciseId===long.id)!;
assert.equal(longDecision.action,'REDUCE_VOLUME');
assert.equal(longDecision.setsDelta,-1);

// 4) Session spillover: later support work should absorb some fatigue after a
// hard earlier block rather than being judged only by total weekly reps.
const support=PROGRAM.Saturday.blocks.find(b=>b.priority==='support' && (b.sets||0)>1)!;
const earlier:SessionSummary={
  ...session('spill',now-86400000,support,[10,10,10],{day:'Saturday',rir:1,fatigue:4}),
  logs:[
    {id:'prior',sessionId:'spill',date:now-86400000,day:'Saturday',exerciseId:'close-pull',exerciseName:'Close Pull',kind:'EMOM',status:'complete',result:{emom:[7,7,7],rir:0,fatigue:5}},
    {id:'support',sessionId:'spill',date:now-86400000,day:'Saturday',exerciseId:support.id,exerciseName:support.name,kind:support.kind,status:'complete',prescription:{version:1,exerciseId:support.id,variantId:support.id,variantName:support.name,name:support.name,kind:support.kind,targetRange:support.target,sets:support.sets,restSec:support.rest,capturedAt:now-86400000},result:{reps:[14,10,8],rir:0,fatigue:4,quality:['Clean','Clean','Shaky']}}
  ],
};
const spillPlan=buildAdaptivePeriodizedDay(week,'Saturday',['oap','flpu'],[earlier],now);
const spillDecision=spillPlan.decisions.find(d=>d.exerciseId===support.id)!;
assert.equal(spillDecision.action,'REDUCE_VOLUME');

// 5) Primary skills are protected from set-aware volume cuts.
const primarySkill=PROGRAM.Saturday.blocks.find(b=>b.priority==='primary'&&b.trainingRole==='skill')!;
const primaryCollapse=session('primary-collapse',now-86400000,primarySkill,[3,3,1],{rir:0,fatigue:5,day:'Saturday'});
const primaryPlan=buildAdaptivePeriodizedDay(week,'Saturday',['oap','flpu'],[primaryCollapse],now);
const primaryDecision=primaryPlan.decisions.find(d=>d.exerciseId===primarySkill.id)!;
assert.notEqual(primaryDecision.action,'REDUCE_VOLUME');

console.log('Phase 22.11 Set-Aware Prescription tests: PASS');
