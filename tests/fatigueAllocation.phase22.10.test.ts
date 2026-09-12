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

const mondayBlocks = PROGRAM.Monday.blocks;
const mondayPrimarySkill = mondayBlocks.find(b => trainingProfileForBlock(b).priority === 'primary' && trainingProfileForBlock(b).role === 'strength')!;
const density = mondayBlocks.find(b => b.trainingMethod === 'DENSITY_5X70')!;
assert.ok(mondayPrimarySkill && density, 'Monday fixture must contain a protected primary strength block and fixed-density block');

// Priority-allocation behavior needs a real secondary + support pair from the current program.
const priorityBlocks = PROGRAM.Saturday.blocks;
const support = priorityBlocks.find(b => trainingProfileForBlock(b).priority === 'support' && (b.sets || 0) > 1)!;
const secondary = priorityBlocks.find(b => trainingProfileForBlock(b).priority === 'secondary' && (b.sets || 0) > 1)!;
const saturdayPrimarySkill = priorityBlocks.find(b => trainingProfileForBlock(b).priority === 'primary' && trainingProfileForBlock(b).role === 'skill')!;
assert.ok(support && secondary && saturdayPrimarySkill, 'Saturday fixture must contain support, secondary and primary-skill blocks');

// Force the moderate fatigue branch without making the fixture itself globally critical.
const phase = {...phasePlanFor('ACCUMULATION',2), fatigueBudget:9};
const tiredMonday = session('tired-monday',now-24*3600000,[density,mondayPrimarySkill]);
const mondayPlan = buildAdaptivePeriodizedDay(phase,'Monday',['oap','flpu','front_lever_touch','pushups','dips'],[tiredMonday],now);
assert.notEqual(mondayPlan.decisions.find(d => d.exerciseId === mondayPrimarySkill.id)!.action,'REDUCE_VOLUME','primary skill/strength must be protected from global fatigue cuts');
assert.notEqual(mondayPlan.decisions.find(d => d.exerciseId === density.id)!.action,'REDUCE_VOLUME','fixed density must never lose a set to global fatigue');
assert.equal(mondayPlan.program.blocks.find(b => b.id === density.id)!.sets,density.densityProtocol?.fixedSets ?? density.sets);

const tiredSaturday = session('tired-saturday',now-24*3600000,[support,secondary]);
const saturdayPlan = buildAdaptivePeriodizedDay(phase,'Saturday',['oap','flpu','front_lever_touch','pushups','dips'],[tiredSaturday],now);
const reduced = saturdayPlan.decisions.filter(d => d.action === 'REDUCE_VOLUME' || d.action === 'REDUCE_DENSITY');
assert.ok(reduced.length <= 2, `fatigue allocation exceeded the moderate session budget: ${reduced.length}`);
assert.ok(reduced.some(d => d.exerciseId === support.id), 'lowest-priority support work should be first reduction candidate');
assert.notEqual(saturdayPlan.decisions.find(d => d.exerciseId === saturdayPrimarySkill.id)!.action,'REDUCE_VOLUME','primary skill must be protected');
const reducedSupportIds = new Set(reduced.filter(d => priorityBlocks.some(b => b.id === d.exerciseId && trainingProfileForBlock(b).priority === 'support')).map(d => d.exerciseId));
assert.ok(reducedSupportIds.size >= 1, 'at least one support block should absorb moderate fatigue reduction');

// Severe fatigue may spend up to three reductions, but still never broadcasts a cut to every block.
const severePhase = {...phasePlanFor('ACCUMULATION',2), fatigueBudget:7};
const severe = buildAdaptivePeriodizedDay(severePhase,'Sunday',['oap','flpu','front_lever_touch','pushups','dips'],[tiredSaturday],now);
const severeReduced = severe.decisions.filter(d => d.action === 'REDUCE_VOLUME' || d.action === 'REDUCE_DENSITY');
const reducibleSundayBlocks = PROGRAM.Sunday.blocks.filter(b => (b.sets || 0) > 1);
assert.ok(severeReduced.length <= 3, `severe fatigue allocation exceeded the session budget: ${severeReduced.length}`);
assert.ok(severeReduced.length < reducibleSundayBlocks.length / 2, 'severe fatigue must not halve the whole session by default');

console.log('Phase 22.10 Fatigue Allocation tests: PASS');
