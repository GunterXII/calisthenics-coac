import assert from 'node:assert/strict';
import { buildCoachProposalDraft } from '../src/coachProposalEngine.ts';
import type { CoachContext } from '../src/coachAdvisorEngine.ts';

const context = {
  phase: {id:'oap',type:'OAP_EMPHASIS',week:2,totalWeeks:4,adaptationWeights:{skill:.3,strength:.3,hypertrophy:.3,endurance:.1,power:0},volumeMultiplier:1,intensityMultiplier:1,hypertrophyFloor:8,fatigueBudget:100},
  goals: [], sessions: [{id:'s1',date:100,day:'Thursday',durationSec:1000,totalReps:20,emomReps:0,bestSkillSeconds:0,readiness:{},logs:[]}], insights: [], weeklyFatigue: 2, recoveryStatus:'FRESH'
} as unknown as CoachContext;

const draft = buildCoachProposalDraft(context, 'posso aumentare il volume dei dips?');
assert.ok(draft);
assert.equal(draft?.action, 'ADD_SET');
assert.ok(draft?.proposal.from);
assert.ok(draft?.proposal.to);
assert.equal(draft?.proposal.status, 'pending');
assert.ok(Array.isArray(draft?.evidence));

const none = buildCoachProposalDraft(context, 'come sta andando il front lever?');
assert.equal(none, null);
console.log('Phase 19 Coach Proposal Engine: PASS');
