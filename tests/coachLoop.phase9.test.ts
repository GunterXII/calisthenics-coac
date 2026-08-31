import assert from 'node:assert/strict';
import { defaultPeriodizationCycle, phaseForCycleWeek } from '../src/periodizationEngine';
import { coachLoopPriority } from '../src/coachLoopEngine';
import type { CoachReview } from '../src/coachReviewEngine';

const cycle = defaultPeriodizationCycle();
assert.equal(cycle.totalWeeks, 16);
assert.equal(phaseForCycleWeek(cycle, 4).type, 'DELOAD');
assert.equal(phaseForCycleWeek(cycle, 8).type, 'DELOAD');
assert.equal(phaseForCycleWeek(cycle, 12).type, 'DELOAD');
assert.equal(phaseForCycleWeek(cycle, 16).type, 'REALIZATION');

const base = {
  id:'r', createdAt:1, phase: phaseForCycleWeek(cycle,1), headline:'', summary:'',
  tone:'GOOD' as const, reasons:[], recommendations:[], goalStates:[],
  phaseDecision:{action:'STAY',reason:'ok',confidence:0.9},
  workload:{totalAdjustedSets:10,fatigueLoad:1,overallRecovery:'FRESH',warnings:[]}
};
assert.equal(coachLoopPriority(base as CoachReview), 'GOOD');
assert.equal(coachLoopPriority({...base, tone:'CAUTION'} as CoachReview), 'CAUTION');
assert.equal(coachLoopPriority({...base, phaseDecision:{action:'DELOAD',reason:'fatigue',confidence:0.9}} as CoachReview), 'ACTION');
console.log('Phase 9 Coach Loop tests: PASS');
