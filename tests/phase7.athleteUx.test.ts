import { strict as assert } from 'node:assert';
import { rirLabel, fatigueLabel, RIR_OPTIONS, FATIGUE_OPTIONS } from '../src/athleteEffort.ts';
import { PROGRAM } from '../src/program.ts';
import { normalizedTrainingProfile, summarizeStimulus } from '../src/trainingModel.ts';
import { masteryCriteriaForBlock, progressionGateForBlock } from '../src/coachingEngine.ts';

assert.deepEqual(RIR_OPTIONS, [0,1,2,3]);
assert.deepEqual(FATIGUE_OPTIONS, [1,2,3,4,5]);
assert.equal(rirLabel(0), 'Nessuna');
assert.equal(rirLabel(3), '3+ reps');
assert.equal(fatigueLabel(1), 'Facile');
assert.equal(fatigueLabel(5), 'Quasi esausto');

const oap = PROGRAM.Thursday.blocks.find(b=>b.id==='oap')!;
const profile = normalizedTrainingProfile(oap);
assert.equal(profile.stimulus.skill, 1);
assert.equal(profile.stimulus.fatigue, 1);

const summary = summarizeStimulus([oap], {oap: 2});
assert.equal(summary.skill, 2);
assert.equal(summary.fatigue, 2);
assert.ok((summary.muscles.lats || 0) > 0);

const trainingGate = progressionGateForBlock(oap);
assert.ok(trainingGate.consecutiveExposures >= 2);
assert.equal(trainingGate.mastery?.type, 'reps');
assert.equal((masteryCriteriaForBlock(oap) as any).minReps, 2);
assert.equal((masteryCriteriaForBlock(oap) as any).side, 'both');

console.log('Phase 7 Athlete UX + Gate tests: PASS');
