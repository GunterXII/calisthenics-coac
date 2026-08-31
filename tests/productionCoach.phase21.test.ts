import assert from 'node:assert/strict';
import { simulateProgramImpact } from '../src/coachImpactEngine.ts';
import { runProductionCoachCycle } from '../src/productionCoachEngine.ts';
import type { CoachContext } from '../src/coachAdvisorEngine.ts';

const phase:any={id:'p',type:'OAP_EMPHASIS',week:2,totalWeeks:3,adaptationWeights:{skill:.3,strength:.3,hypertrophy:.3,endurance:.1,power:0},volumeMultiplier:1,intensityMultiplier:1,hypertrophyFloor:3,fatigueBudget:100};
const context:any={phase,sessions:[],goals:[],insights:[],weeklyFatigue:0,recoveryStatus:'FRESH',hypertrophy:[],skillReadiness:[]};
const impact=simulateProgramImpact(context,'oap','ADD_SET',1);
assert.equal(impact,null);
const cycle=runProductionCoachCycle(context as CoachContext);
assert.ok(cycle.review);
assert.equal(typeof cycle.requiresHumanDecision,'boolean');
console.log('Phase 21 production coach loop PASS');
