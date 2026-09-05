import { strict as assert } from 'node:assert';
import { PROGRAM } from '../src/program.ts';
import { buildAdaptivePeriodizedDay } from '../src/adaptiveProgramEngine.ts';
import { phasePlanFor } from '../src/periodizationEngine.ts';
import { trainingProfileForBlock } from '../src/trainingModel.ts';
import type { SessionSummary } from '../src/types.ts';

const now = Date.now();
const readiness = {sleepHours:8,energy:5,wristPain:0,elbowPain:0,weightKg:80};

function session(id:string, date:number, blocks:any[]):SessionSummary {
  return {
    id,
    date,
    day:'Monday',
    durationSec:3600,
    readiness,
    logs:blocks.map((b:any,i:number)=>({
      id:`${id}-l${i}`,
      exerciseId:b.id,
      exerciseName:b.name,
      kind:b.kind,
      status:'complete',
      prescription:{
        version:1,
        exerciseId:b.id,
        variantId:b.id,
        variantName:b.name,
        name:b.name,
        kind:b.kind,
        targetRange:b.target,
        sets:b.sets,
        restSec:b.rest,
        progressionMode:b.progressionMode,
        fatigueCost:b.fatigueCost,
        muscleGroups:b.muscleGroups,
        effectiveSetWeight:b.effectiveSetWeight,
        gripDemand:b.gripDemand,
        capturedAt:date,
      },
      result:{reps:[10,10],rir:2,quality:['Clean','Clean']},
    })),
    totalReps:100,
    emomReps:0,
    bestSkillSeconds:10,
  };
}

const baseBlocks = PROGRAM.Monday.blocks;
const support = baseBlocks.find(b => trainingProfileForBlock(b).priority === 'support' && (b.sets || 0) > 1)!;
const secondary = baseBlocks.find(b => trainingProfileForBlock(b).priority === 'secondary' && (b.sets || 0) > 1 && b.id !== support.id)!;
const primarySkill = baseBlocks.find(b => trainingProfileForBlock(b).priority === 'primary' && trainingProfileForBlock(b).role === 'skill')!;
const density = baseBlocks.find(b => b.trainingMethod === 'DENSITY_5X70')!;
assert.ok(support && secondary && primarySkill && density, 'fixture must contain support, secondary, primary skill and fixed-density blocks');

// Force the moderate fatigue branch without making the fixture itself globally critical.
const phase = {...phasePlanFor('ACCUMULATION',2), fatigueBudget:9};
const tired = session('tired',now-24*3600000,[support,secondary]);
const plan = buildAdaptivePeriodizedDay(phase,'Monday',['oap','flpu','front_lever_touch','pushups','dips'],[tired],now);
const reduced = plan.decisions.filter(d => d.action === 'REDUCE_VOLUME' || d.action === 'REDUCE_DENSITY');

assert.ok(reduced.length <= 2, `fatigue allocation exceeded the moderate session budget: ${reduced.length}`);
assert.ok(reduced.some(d => d.exerciseId === support.id), 'lowest-priority support work should be first reduction candidate');
assert.notEqual(plan.decisions.find(d => d.exerciseId === primarySkill.id)!.action,'REDUCE_VOLUME','primary skill must be protected');
assert.notEqual(plan.decisions.find(d => d.exerciseId === density.id)!.action,'REDUCE_VOLUME','fixed density must never lose a set to global fatigue');
assert.equal(plan.program.blocks.find(b => b.id === support.id)!.sets,Math.max(1,(support.sets || 0)-1));

// Severe fatigue may spend up to three reductions, but still never broadcasts a cut to every block.
const severePhase = {...phasePlanFor('ACCUMULATION',2), fatigueBudget:7};
const severe = buildAdaptivePeriodizedDay(severePhase,'Monday',['oap','flpu','front_lever_touch','pushups','dips'],[tired],now);
const severeReduced = severe.decisions.filter(d => d.action === 'REDUCE_VOLUME' || d.action === 'REDUCE_DENSITY');
assert.ok(severeReduced.length <= 3, `severe fatigue allocation exceeded the session budget: ${severeReduced.length}`);
assert.ok(severeReduced.length < baseBlocks.filter(b => (b.sets || 0) > 1).length / 2, 'severe fatigue must not halve the whole session by default');
assert.notEqual(severe.decisions.find(d => d.exerciseId === primarySkill.id)!.action,'REDUCE_VOLUME');

console.log('Phase 22.10 Fatigue Allocation tests: PASS');
